// extractors.js — Multi-language regex-based symbol extractor.
// Pure Node.js, ZERO external dependencies. Exports a single
// `extractSymbols(source, language, filePath)` function that
// dispatches to per-language extractors for JavaScript, TypeScript,
// Python, Go, Rust, Java, C#, C, and C++.

"use strict";

const { stripComments } = require("./utils");

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Keywords that look like calls in C-family languages but are not.
const CALL_KEYWORDS_C = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "return",
  "throw",
  "new",
  "delete",
  "typeof",
  "void",
  "in",
  "of",
  "do",
  "case",
  "default",
  "else",
  "try",
  "finally",
  "yield",
  "await",
  "async",
  "function",
  "class",
  "extends",
  "instanceof",
]);

// Keywords that look like calls in Python but are not.
const CALL_KEYWORDS_PY = new Set([
  "if",
  "for",
  "while",
  "with",
  "return",
  "raise",
  "del",
  "assert",
  "yield",
  "await",
  "async",
  "not",
  "and",
  "or",
  "is",
  "in",
  "lambda",
  "def",
  "class",
  "import",
  "from",
  "except",
  "finally",
  "else",
  "elif",
]);

/**
 * Map 0-based line index -> 1-based line number.
 */
const lineNum = (idx) => idx + 1;

/**
 * Extract a list of "calls" by scanning the source for `name(` patterns.
 * `keywords` is a Set of identifiers that look like calls but must be skipped.
 */
const extractCalls = (source, keywords) => {
  const calls = [];
  const lines = source.split("\n");
  // Match: word boundary + identifier + ( — also catch `obj.method(` chains.
  const re = /[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*\s*\(/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      const full = m[0];
      // Strip trailing "(" and whitespace to get just the identifier name.
      // For chained calls like "obj.method(", keep the first segment only.
      const name = full.replace(/\s*\($/, "").split(".")[0];
      if (keywords.has(name)) continue;
      // Skip obvious false positives like "0(" or "=" adjacent — re already
      // ensures word boundary at start. The first char of match is a letter
      // or `_` or `$`, so we are good.
      calls.push({ name, line: lineNum(i), col: m.index });
    }
  }
  return calls;
};

/**
 * Build a "signature" string from the original source — the trimmed
 * declaration line, capped at 200 characters.
 */
const makeSignature = (source, lineIdx) => {
  if (lineIdx < 0 || lineIdx >= source.split("\n").length) return null;
  const lines = source.split("\n");
  let sig = lines[lineIdx].trim();
  if (sig.length > 200) sig = sig.slice(0, 200) + "...";
  return sig || null;
};

/**
 * Walk forward from `startLine` and try to estimate the end of a brace
 * block. Returns 1-based end line, or null if no closing brace found.
 */
const estimateEndLine = (source, startLine) => {
  const lines = source.split("\n");
  // Find the opening brace on or after startLine.
  let openLine = -1;
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].indexOf("{") !== -1) {
      openLine = i;
      break;
    }
    // Single-line declarations without braces (e.g. `def f(): return 1`)
    if (i > startLine && lines[i].trim() && !lines[i].trim().startsWith("#")) {
      // For Python-style single-line bodies, end at first non-empty body line.
      if (lines[startLine].trimEnd().endsWith(":")) {
        return lineNum(i);
      }
    }
  }
  if (openLine === -1) return null;

  let depth = 0;
  for (let i = openLine; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      // Skip strings.
      if (ch === '"' || ch === "'" || ch === "`") {
        const quote = ch;
        j++;
        while (j < line.length && line[j] !== quote) {
          if (line[j] === "\\") j++;
          j++;
        }
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return lineNum(i);
      }
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// JavaScript / TypeScript extractor
// ---------------------------------------------------------------------------

const extractJavaScript = (source, filePath, language) => {
  const symbols = [];
  const lines = source.split("\n");
  let currentClass = null;
  let classIndent = -1;
  let braceDepth = 0;
  let classOpenDepth = -1;

  // Regexes for top-level (class scope tracking handled separately).
  const funcRe =
    /^(?:\s*(?:export\s+)?(?:async\s+)?function\*?\s+)([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/;
  const classRe =
    /^(?:\s*(?:export\s+)?(?:abstract\s+)?class\s+)([A-Za-z_$][A-Za-z0-9_$]*)/;
  const arrowRe =
    /^(?:\s*(?:export\s+)?(?:const|let|var)\s+)([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?\(/;
  const interfaceRe =
    /^(?:\s*(?:export\s+)?interface\s+)([A-Za-z_$][A-Za-z0-9_$]*)/;
  const enumRe =
    /^(?:\s*(?:export\s+)?(?:const\s+)?enum\s+)([A-Za-z_$][A-Za-z0-9_$]*)/;
  const typeAliasRe =
    /^(?:\s*(?:export\s+)?type\s+)([A-Za-z_$][A-Za-z0-9_$]*)\s*=/;
  const methodRe =
    /^\s*(?:(public|private|protected|static|async|get|set|abstract|readonly|override)\s+)*([A-Za-z_$][A-Za-z0-9_$]*|#?[A-Za-z_$][A-Za-z0-9_$]*)\s*\(/;
  const importRe = /^\s*import\s+(?:.*?from\s+)?['"]([^'"]+)['"]/;
  const importNameRe =
    /^\s*import\s+(?:\{([^}]+)\}|([A-Za-z_$][A-Za-z0-9_$]*)|\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*))/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Track braces to know when we exit a class.
    for (const ch of line) {
      if (ch === "{") braceDepth++;
      else if (ch === "}") {
        braceDepth--;
        if (classOpenDepth !== -1 && braceDepth < classOpenDepth) {
          currentClass = null;
          classOpenDepth = -1;
        }
      }
    }

    // Inside a class body? Look for methods.
    if (currentClass !== null) {
      const m = methodRe.exec(line);
      if (m) {
        // Filter out language keywords that look like method names.
        const name = m[2];
        if (name && !CALL_KEYWORDS_C.has(name)) {
          const mods = (m[1] || "").split(/\s+/).filter(Boolean);
          if (name.startsWith("#")) mods.push("private");
          symbols.push({
            name,
            kind: "method",
            line: lineNum(i),
            endLine: estimateEndLine(source, i),
            signature: makeSignature(source, i),
            modifiers: mods,
            parent: currentClass,
          });
          continue;
        }
      }
      continue;
    }

    // Top-level: function declaration.
    let m = funcRe.exec(line);
    if (m) {
      const mods = [];
      if (/\bexport\b/.test(line)) mods.push("export");
      if (/\basync\b/.test(line)) mods.push("async");
      symbols.push({
        name: m[1],
        kind: "function",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: mods,
        parent: null,
      });
      continue;
    }

    // Top-level: class declaration.
    m = classRe.exec(line);
    if (m) {
      const mods = [];
      if (/\bexport\b/.test(line)) mods.push("export");
      if (/\babstract\b/.test(line)) mods.push("abstract");
      currentClass = m[1];
      // The class body opens at braceDepth (after counting this line's
      // opening brace). When braces drop below that, we've left the class.
      classOpenDepth = braceDepth;
      symbols.push({
        name: m[1],
        kind: "class",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: mods,
        parent: null,
      });
      continue;
    }

    // Top-level: arrow function assigned to const/let/var.
    m = arrowRe.exec(line);
    if (m) {
      const mods = [];
      if (/\bexport\b/.test(line)) mods.push("export");
      if (/\basync\b/.test(line)) mods.push("async");
      symbols.push({
        name: m[1],
        kind: "variable",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: mods,
        parent: null,
      });
      continue;
    }

    // TypeScript-only: interface.
    if (language === "typescript") {
      m = interfaceRe.exec(line);
      if (m) {
        symbols.push({
          name: m[1],
          kind: "interface",
          line: lineNum(i),
          endLine: estimateEndLine(source, i),
          signature: makeSignature(source, i),
          modifiers: /\bexport\b/.test(line) ? ["export"] : [],
          parent: null,
        });
        continue;
      }
      m = enumRe.exec(line);
      if (m) {
        symbols.push({
          name: m[1],
          kind: "enum",
          line: lineNum(i),
          endLine: estimateEndLine(source, i),
          signature: makeSignature(source, i),
          modifiers: /\bexport\b/.test(line) ? ["export"] : [],
          parent: null,
        });
        continue;
      }
      m = typeAliasRe.exec(line);
      if (m) {
        symbols.push({
          name: m[1],
          kind: "interface",
          line: lineNum(i),
          endLine: null,
          signature: makeSignature(source, i),
          modifiers: /\bexport\b/.test(line) ? ["export"] : [],
          parent: null,
        });
        continue;
      }
    }

    // Import.
    m = importNameRe.exec(line);
    if (m) {
      let name = null;
      if (m[1]) {
        // Take the first named import as the canonical name.
        const first = m[1]
          .split(",")[0]
          .trim()
          .split(/\s+as\s+/)
          .pop();
        name = first;
      } else if (m[2]) {
        name = m[2];
      } else if (m[3]) {
        name = m[3];
      }
      if (name) {
        symbols.push({
          name,
          kind: "import",
          line: lineNum(i),
          endLine: null,
          signature: makeSignature(source, i),
          modifiers: ["import"],
          parent: null,
        });
      }
      continue;
    }
  }

  const calls = extractCalls(source, CALL_KEYWORDS_C);
  return { symbols, calls };
};

// ---------------------------------------------------------------------------
// Python extractor
// ---------------------------------------------------------------------------

const extractPython = (source, filePath) => {
  const symbols = [];
  const lines = source.split("\n");
  const classStack = []; // [{ name, indent, endLine }]

  const funcRe = /^(\s*)(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
  const classRe = /^(\s*)class\s+([A-Za-z_][A-Za-z0-9_]*)/;
  const importRe = /^\s*from\s+([A-Za-z_][A-Za-z0-9_.]*)\s+import\s+(.+)/;
  const importSimpleRe = /^\s*import\s+([A-Za-z_][A-Za-z0-9_.]*)/;

  // First pass: identify class end lines.
  const classBounds = [];
  for (let i = 0; i < lines.length; i++) {
    const m = classRe.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    // Find the next line at indent <= this class's indent.
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j];
      if (!t.trim() || t.trim().startsWith("#")) continue;
      const tj = t.match(/^(\s*)/)[1].length;
      if (tj <= indent) {
        end = j;
        break;
      }
    }
    classBounds.push({ name: m[2], start: i, end, indent });
  }

  const findParent = (lineIdx, indent) => {
    let best = null;
    for (const cb of classBounds) {
      if (cb.start < lineIdx && lineIdx < cb.end && cb.indent < indent) {
        if (!best || cb.indent > best.indent) best = cb;
      }
    }
    return best ? best.name : null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Import (simple).
    let m = importSimpleRe.exec(line);
    if (m) {
      const name = m[1].split(".")[0];
      symbols.push({
        name,
        kind: "import",
        line: lineNum(i),
        endLine: null,
        signature: makeSignature(source, i),
        modifiers: ["import"],
        parent: null,
      });
      continue;
    }

    // Import (from ... import).
    m = importRe.exec(line);
    if (m) {
      const names = m[2]
        .replace("(", "")
        .replace(")", "")
        .split(",")
        .map((s) =>
          s
            .trim()
            .split(/\s+as\s+/)
            .pop(),
        )
        .filter(Boolean);
      for (const n of names) {
        symbols.push({
          name: n,
          kind: "import",
          line: lineNum(i),
          endLine: null,
          signature: makeSignature(source, i),
          modifiers: ["import"],
          parent: null,
        });
      }
      continue;
    }

    // Class.
    m = classRe.exec(line);
    if (m) {
      const indent = m[1].length;
      const cb = classBounds.find((c) => c.start === i && c.name === m[2]);
      symbols.push({
        name: m[2],
        kind: "class",
        line: lineNum(i),
        endLine: cb ? lineNum(cb.end - 1) : null,
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    // Function or method.
    m = funcRe.exec(line);
    if (m) {
      const indent = m[1].length;
      const parent = findParent(i, indent);
      const isMethod = parent !== null;
      const mods = [];
      if (/\basync\s+def\b/.test(line)) mods.push("async");
      if (isMethod && /\bself\b/.test(line)) mods.push("method");
      // Detect decorators on previous non-blank lines.
      let j = i - 1;
      while (j >= 0 && lines[j].trim() === "") j--;
      if (j >= 0 && lines[j].trim().startsWith("@")) {
        mods.push("decorated");
      }
      symbols.push({
        name: m[2],
        kind: isMethod ? "method" : "function",
        line: lineNum(i),
        endLine: null,
        signature: makeSignature(source, i),
        modifiers: mods,
        parent,
      });
      continue;
    }
  }

  const calls = extractCalls(source, CALL_KEYWORDS_PY);
  return { symbols, calls };
};

// ---------------------------------------------------------------------------
// Go extractor
// ---------------------------------------------------------------------------

const extractGo = (source, filePath) => {
  const symbols = [];
  const lines = source.split("\n");

  const funcRe = /^func\s+(?:\([^)]+\)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
  const typeStructRe = /^type\s+([A-Za-z_][A-Za-z0-9_]*)\s+struct\b/;
  const typeIfaceRe = /^type\s+([A-Za-z_][A-Za-z0-9_]*)\s+interface\b/;
  const importRe = /^\s*import\s+(?:"([^"]+)"|(?:\(([\s\S]*?)\)))/;
  const typeAliasRe = /^type\s+([A-Za-z_][A-Za-z0-9_]*)\s+=/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Imports: handle multi-line `import ( ... )` blocks.
    let m = importRe.exec(line);
    if (m) {
      if (m[1]) {
        // Single-line import.
        const pkg = m[1].split("/").pop();
        symbols.push({
          name: pkg,
          kind: "import",
          line: lineNum(i),
          endLine: null,
          signature: makeSignature(source, i),
          modifiers: ["import"],
          parent: null,
        });
      } else if (m[2]) {
        // Multi-line import: parse each quoted path.
        const quoted = m[2].match(/"([^"]+)"/g) || [];
        for (const q of quoted) {
          const pkg = q.replace(/"/g, "").split("/").pop();
          if (pkg) {
            symbols.push({
              name: pkg,
              kind: "import",
              line: lineNum(i),
              endLine: null,
              signature: makeSignature(source, i),
              modifiers: ["import"],
              parent: null,
            });
          }
        }
      }
      continue;
    }

    m = funcRe.exec(line);
    if (m) {
      // Check for receiver only in the prefix before the function name.
      const prefix = line.slice(0, m.index + m[0].length);
      const isMethod =
        /\([^)]+\)\s+[A-Z]/.test(prefix) &&
        /\([^)]+\)\s+/.test(line.slice(0, line.indexOf(m[1])));
      symbols.push({
        name: m[1],
        kind: isMethod ? "method" : "function",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    m = typeStructRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "struct",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    m = typeIfaceRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "interface",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    m = typeAliasRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "variable",
        line: lineNum(i),
        endLine: null,
        signature: makeSignature(source, i),
        modifiers: ["type"],
        parent: null,
      });
    }
  }

  const calls = extractCalls(source, CALL_KEYWORDS_C);
  return { symbols, calls };
};

// ---------------------------------------------------------------------------
// Rust extractor
// ---------------------------------------------------------------------------

const extractRust = (source, filePath) => {
  const symbols = [];
  const lines = source.split("\n");

  const fnRe =
    /^(?:\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:const\s+)?(?:unsafe\s+)?(?:extern\s+(?:"[^"]+"\s+)?)?fn\s+)([A-Za-z_][A-Za-z0-9_]*)/;
  const structRe =
    /^(?:\s*(?:pub(?:\([^)]*\))?\s+)?struct\s+)([A-Za-z_][A-Za-z0-9_]*)/;
  const enumRe =
    /^(?:\s*(?:pub(?:\([^)]*\))?\s+)?enum\s+)([A-Za-z_][A-Za-z0-9_]*)/;
  const traitRe =
    /^(?:\s*(?:pub(?:\([^)]*\))?\s+)?trait\s+)([A-Za-z_][A-Za-z0-9_]*)/;
  const implRe =
    /^(?:\s*impl(?:\s*<[^>]*>)?\s+)([A-Za-z_][A-Za-z0-9_:]*)(?:\s+for\s+([A-Za-z_][A-Za-z0-9_]*))?/;
  const useRe = /^\s*use\s+([^;]+);/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let m = fnRe.exec(line);
    if (m) {
      const mods = [];
      if (/\bpub\b/.test(line)) mods.push("public");
      if (/\basync\b/.test(line)) mods.push("async");
      if (/\bconst\b/.test(line)) mods.push("const");
      if (/\bunsafe\b/.test(line)) mods.push("unsafe");
      symbols.push({
        name: m[1],
        kind: "function",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: mods,
        parent: null,
      });
      continue;
    }

    m = structRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "struct",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: /\bpub\b/.test(line) ? ["public"] : [],
        parent: null,
      });
      continue;
    }

    m = enumRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "enum",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: /\bpub\b/.test(line) ? ["public"] : [],
        parent: null,
      });
      continue;
    }

    m = traitRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "trait",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: /\bpub\b/.test(line) ? ["public"] : [],
        parent: null,
      });
      continue;
    }

    m = implRe.exec(line);
    if (m) {
      // Record the impl target as a class-like symbol so methods can be linked.
      const target = m[2] || m[1];
      symbols.push({
        name: target,
        kind: "class",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: ["impl"],
        parent: null,
      });
      continue;
    }

    m = useRe.exec(line);
    if (m) {
      // Take the last segment of the use path as the symbol name.
      const parts = m[1].split("::");
      const last = parts[parts.length - 1].trim();
      const name = last
        .replace(/^use\s+/, "")
        .replace(/[{}*]/g, "")
        .split(/\s+as\s+/)
        .pop();
      if (name) {
        symbols.push({
          name,
          kind: "import",
          line: lineNum(i),
          endLine: null,
          signature: makeSignature(source, i),
          modifiers: ["use"],
          parent: null,
        });
      }
    }
  }

  const calls = extractCalls(source, CALL_KEYWORDS_C);
  return { symbols, calls };
};

// ---------------------------------------------------------------------------
// Java extractor
// ---------------------------------------------------------------------------

const extractJava = (source, filePath) => {
  const symbols = [];
  const lines = source.split("\n");
  let currentClass = null;
  let classOpenDepth = -1;
  let braceDepth = 0;

  const classRe =
    /^(?:\s*(?:public|private|protected)\s+)?(?:abstract\s+|final\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/;
  const ifaceRe =
    /^(?:\s*(?:public|private|protected)\s+)?interface\s+([A-Za-z_][A-Za-z0-9_]*)/;
  const enumRe =
    /^(?:\s*(?:public|private|protected)\s+)?enum\s+([A-Za-z_][A-Za-z0-9_]*)/;
  const methodRe =
    /^\s*(?:(public|private|protected|static|final|abstract|synchronized|native|default)\s+)*(?:<[^>]*>\s+)?(?:[A-Za-z_][A-Za-z0-9_<>?\[\],\s]*?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
  const importRe = /^\s*import\s+(?:static\s+)?([A-Za-z_][A-Za-z0-9_.]*)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track braces.
    for (const ch of line) {
      if (ch === "{") {
        braceDepth++;
      } else if (ch === "}") {
        braceDepth--;
        if (classOpenDepth !== -1 && braceDepth < classOpenDepth) {
          currentClass = null;
          classOpenDepth = -1;
        }
      }
    }

    // Inside class — try method.
    if (currentClass !== null) {
      const m = methodRe.exec(line);
      if (m && m[2]) {
        const name = m[2];
        if (!CALL_KEYWORDS_C.has(name) && name !== currentClass) {
          const mods = (m[1] || "").split(/\s+/).filter(Boolean);
          symbols.push({
            name,
            kind: "method",
            line: lineNum(i),
            endLine: estimateEndLine(source, i),
            signature: makeSignature(source, i),
            modifiers: mods,
            parent: currentClass,
          });
          continue;
        }
      }
    }

    let m = classRe.exec(line);
    if (m) {
      const mods = [];
      if (/\bpublic\b/.test(line)) mods.push("public");
      if (/\bprivate\b/.test(line)) mods.push("private");
      if (/\bprotected\b/.test(line)) mods.push("protected");
      if (/\babstract\b/.test(line)) mods.push("abstract");
      if (/\bfinal\b/.test(line)) mods.push("final");
      currentClass = m[1];
      // The class body opens at braceDepth (after counting this line's
      // opening brace). When braces drop below that, we've left the class.
      classOpenDepth = braceDepth;
      symbols.push({
        name: m[1],
        kind: "class",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: mods,
        parent: null,
      });
      continue;
    }

    m = ifaceRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "interface",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    m = enumRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "enum",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    m = importRe.exec(line);
    if (m) {
      const parts = m[1].split(".");
      const name = parts[parts.length - 1];
      symbols.push({
        name,
        kind: "import",
        line: lineNum(i),
        endLine: null,
        signature: makeSignature(source, i),
        modifiers: ["import"],
        parent: null,
      });
    }
  }

  const calls = extractCalls(source, CALL_KEYWORDS_C);
  return { symbols, calls };
};

// ---------------------------------------------------------------------------
// C# extractor
// ---------------------------------------------------------------------------

const extractCSharp = (source, filePath) => {
  const symbols = [];
  const lines = source.split("\n");
  let currentClass = null;
  let classOpenDepth = -1;
  let braceDepth = 0;

  const classRe =
    /^(?:\s*(?:public|private|protected|internal|static|sealed|abstract|partial)\s+)*class\s+([A-Za-z_][A-Za-z0-9_]*)/;
  const ifaceRe =
    /^(?:\s*(?:public|private|protected|internal)\s+)?interface\s+([A-Za-z_][A-Za-z0-9_]*)/;
  const structRe =
    /^(?:\s*(?:public|private|protected|internal|readonly|ref)\s+)*struct\s+([A-Za-z_][A-Za-z0-9_]*)/;
  const enumRe =
    /^(?:\s*(?:public|private|protected|internal)\s+)?enum\s+([A-Za-z_][A-Za-z0-9_]*)/;
  const methodRe =
    /^\s*(?:(public|private|protected|internal|static|virtual|override|abstract|sealed|async|extern|partial|new|readonly|unsafe)\s+)*(?:<[^>]*>\s+)?(?:[A-Za-z_][A-Za-z0-9_<>?\[\],\s]*?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
  const propRe =
    /^\s*(?:(public|private|protected|internal|static|virtual|override|abstract)\s+)*(?:[A-Za-z_][A-Za-z0-9_<>?\[\],\s]*?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{\s*(?:get|set)/;
  const usingRe = /^\s*using\s+(?:static\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*;/;
  const attrRe = /^\s*\[([A-Za-z_][A-Za-z0-9_.()",]*)\]/;
  const nsRe = /^(?:\s*namespace\s+)([A-Za-z_][A-Za-z0-9_.]*)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Track braces.
    for (const ch of line) {
      if (ch === "{") {
        braceDepth++;
      } else if (ch === "}") {
        braceDepth--;
        if (classOpenDepth !== -1 && braceDepth < classOpenDepth) {
          currentClass = null;
          classOpenDepth = -1;
        }
      }
    }

    // Attribute — record as a modifier on the NEXT non-blank line's symbol.
    const attrMatch = attrRe.exec(line);
    if (attrMatch) {
      // Look ahead for the next symbol line; annotate modifiers there.
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length) {
        // Stash attribute name in a side-channel: attach to the line's symbols later.
        // Simpler: just add it as its own symbol so it's discoverable.
        symbols.push({
          name: attrMatch[1].split("(")[0],
          kind: "variable",
          line: lineNum(i),
          endLine: null,
          signature: makeSignature(source, i),
          modifiers: ["attribute"],
          parent: null,
        });
      }
      continue;
    }

    // Namespace.
    let m = nsRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "namespace",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    // Inside class body — method or property.
    if (currentClass !== null) {
      const pm = propRe.exec(line);
      if (pm && pm[2]) {
        const mods = (pm[1] || "").split(/\s+/).filter(Boolean);
        symbols.push({
          name: pm[2],
          kind: "property",
          line: lineNum(i),
          endLine: estimateEndLine(source, i),
          signature: makeSignature(source, i),
          modifiers: mods,
          parent: currentClass,
        });
        continue;
      }
      const mm = methodRe.exec(line);
      if (mm && mm[2]) {
        const name = mm[2];
        if (!CALL_KEYWORDS_C.has(name) && name !== currentClass) {
          const mods = (mm[1] || "").split(/\s+/).filter(Boolean);
          symbols.push({
            name,
            kind: "method",
            line: lineNum(i),
            endLine: estimateEndLine(source, i),
            signature: makeSignature(source, i),
            modifiers: mods,
            parent: currentClass,
          });
          continue;
        }
      }
    }

    m = classRe.exec(line);
    if (m) {
      currentClass = m[1];
      // The class body opens at braceDepth (after counting this line's
      // opening brace). When braces drop below that, we've left the class.
      classOpenDepth = braceDepth;
      symbols.push({
        name: m[1],
        kind: "class",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    m = structRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "struct",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    m = ifaceRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "interface",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    m = enumRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "enum",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    m = usingRe.exec(line);
    if (m) {
      const parts = m[1].split(".");
      symbols.push({
        name: parts[parts.length - 1],
        kind: "import",
        line: lineNum(i),
        endLine: null,
        signature: makeSignature(source, i),
        modifiers: ["using"],
        parent: null,
      });
    }
  }

  const calls = extractCalls(source, CALL_KEYWORDS_C);
  return { symbols, calls };
};

// ---------------------------------------------------------------------------
// C / C++ extractor
// ---------------------------------------------------------------------------

const extractCpp = (source, filePath, language) => {
  const symbols = [];
  const lines = source.split("\n");

  const funcRe =
    /^(?:\s*(?:static|inline|extern|virtual|explicit|const|constexpr|template\s*<[^>]*>\s+)*)(?:[A-Za-z_][A-Za-z0-9_:*&<>\s]*?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
  const classRe =
    /^(?:\s*(?:template\s*<[^>]*>\s+)?(?:class|struct)\s+)([A-Za-z_][A-Za-z0-9_]*)/;
  const nsRe = /^(?:\s*namespace\s+)([A-Za-z_][A-Za-z0-9_]*)/;
  const includeRe = /^\s*#include\s+(?:<([^>]+)>|"([^"]+)")/;
  const methodCallRe =
    /([A-Za-z_][A-Za-z0-9_]*)::([A-Za-z_][A-Za-z0-9_]*)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let m = includeRe.exec(line);
    if (m) {
      const inc = m[1] || m[2];
      const name = inc.split("/").pop();
      symbols.push({
        name,
        kind: "import",
        line: lineNum(i),
        endLine: null,
        signature: makeSignature(source, i),
        modifiers: ["include"],
        parent: null,
      });
      continue;
    }

    m = classRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "class",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    m = nsRe.exec(line);
    if (m) {
      symbols.push({
        name: m[1],
        kind: "namespace",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: null,
      });
      continue;
    }

    m = funcRe.exec(line);
    if (m) {
      const name = m[1];
      // Skip obvious false positives.
      if (CALL_KEYWORDS_C.has(name)) continue;
      // Skip macro-like uppercase single tokens.
      const mcall = methodCallRe.exec(line);
      const isMethod = mcall && mcall[1] && mcall[2] === name;
      symbols.push({
        name,
        kind: isMethod ? "method" : "function",
        line: lineNum(i),
        endLine: estimateEndLine(source, i),
        signature: makeSignature(source, i),
        modifiers: [],
        parent: isMethod ? mcall[1] : null,
      });
    }
  }

  const calls = extractCalls(source, CALL_KEYWORDS_C);
  return { symbols, calls };
};

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const EXTRACTORS = {
  javascript: (source, filePath) =>
    extractJavaScript(source, filePath, "javascript"),
  typescript: (source, filePath) =>
    extractJavaScript(source, filePath, "typescript"),
  python: extractPython,
  go: extractGo,
  rust: extractRust,
  java: extractJava,
  csharp: extractCSharp,
  c: extractCpp,
  cpp: extractCpp,
};

const extractSymbols = (source, language, filePath) => {
  try {
    const extractor = EXTRACTORS[language];
    if (!extractor) {
      return { symbols: [], calls: [] };
    }
    // Strip comments and string literals first so regexes don't match
    // inside strings or comments. Use the existing utils helper.
    let cleaned = source;
    try {
      cleaned = stripComments(source, language);
    } catch (err) {
      // If stripping fails, fall back to raw source.
      cleaned = source;
    }
    const result = extractor(cleaned, filePath);
    if (!result || !Array.isArray(result.symbols)) {
      return { symbols: [], calls: [] };
    }
    return {
      symbols: result.symbols,
      calls: Array.isArray(result.calls) ? result.calls : [],
    };
  } catch (err) {
    // Never throw — return empty result on any failure.
    return { symbols: [], calls: [] };
  }
};

module.exports = { extractSymbols };
