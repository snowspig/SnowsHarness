// utils.js — Code indexing utilities
// Pure Node.js, zero external dependencies.
// Provides source-code stripping, file walking, hashing, and language detection
// for the SnowsHarness code indexer.

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Directories to skip during recursive walks.
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "__pycache__",
  ".venv",
  "venv",
  "dist",
  "build",
  "target",
  ".next",
  ".snows-index",
  ".codegraph",
  "vendor",
  "Pods",
  ".cache",
  ".turbo",
  "coverage",
]);

// File extension -> language map.
const EXT_LANG = {
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".cs": "csharp",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".css": "css",
  ".scss": "css",
  ".less": "css",
};

/**
 * Determine the comment style for a given language.
 * Returns { line: '...' } for single-line and { block: ['...','...'] }
 * for multi-line. Either field may be missing.
 */
const getCommentStyle = (lang) => {
  switch (lang) {
    case "python":
      return { line: "#", block: ['"""', "'''"] };
    case "ruby":
      return { line: "#" };
    case "sql":
      return { line: "--" };
    default:
      // C-family (js, ts, java, csharp, c, cpp, rust, go, css, etc.)
      return { line: "//", block: ["/*", "*/"] };
  }
};

/**
 * Strip comments and string literals from source code.
 * Replaces content with whitespace so line numbers are preserved
 * and regex extraction does not match on string/comment text.
 */
const stripComments = (source, lang) => {
  const style = getCommentStyle(lang);
  const lines = source.split("\n");
  const result = [];
  let inBlock = null; // active block-comment opener
  let inString = null; // active string delimiter (" or ')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const out = new Array(line.length).fill(" ");
    let j = 0;

    while (j < line.length) {
      const two = line.slice(j, j + 2);
      const ch = line[j];

      // Inside block comment — look for closer.
      if (inBlock) {
        const closeIdx = line.indexOf(inBlock, j);
        if (closeIdx === -1) {
          j = line.length;
        } else {
          j = closeIdx + inBlock.length;
          inBlock = null;
        }
        continue;
      }

      // Inside string literal — look for matching close or escape.
      if (inString) {
        if (ch === "\\" && j + 1 < line.length) {
          j += 2;
          continue;
        }
        if (ch === inString) {
          inString = null;
          j++;
          continue;
        }
        j++;
        continue;
      }

      // Block comment opener.
      if (style.block && two === style.block[0]) {
        inBlock = style.block[1];
        j += 2;
        continue;
      }

      // Single-line comment.
      if (style.line && two === style.line) {
        break;
      }

      // String literals — replace content but preserve delimiters.
      if (ch === '"' || ch === "'") {
        inString = ch;
        out[j] = ch;
        j++;
        continue;
      }

      // Template literal: leave delimiters, blank out content.
      if (ch === "`") {
        let k = j + 1;
        while (k < line.length && line[k] !== "`") {
          if (line[k] === "\\" && k + 1 < line.length) k += 2;
          else k++;
        }
        out[j] = "`";
        if (k < line.length) {
          out[k] = "`";
          j = k + 1;
        } else {
          j = k;
        }
        continue;
      }

      // Normal character — keep as-is.
      out[j] = line[j];
      j++;
    }

    result.push(out.join(""));
  }

  return result.join("\n");
};

/**
 * Walk projectDir recursively and return source-file metadata.
 */
const walkSourceFiles = (projectDir) => {
  const results = [];
  const entries = fs.readdirSync(projectDir, {
    withFileTypes: true,
    recursive: true,
  });

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const fullPath = path.join(entry.parentPath || entry.path, entry.name);
    // Normalize to forward slashes.
    const relRaw = path.relative(projectDir, fullPath);
    if (relRaw.startsWith("..")) continue;

    const parts = relRaw.split(path.sep);
    if (parts.some((p) => SKIP_DIRS.has(p))) continue;

    const ext = path.extname(entry.name).toLowerCase();
    const language = EXT_LANG[ext];
    if (!language) continue;

    const stat = fs.statSync(fullPath);
    if (stat.size > 1024 * 1024) continue; // skip > 1MB

    results.push({
      path: relRaw.split(path.sep).join("/"),
      language,
      mtime: stat.mtimeMs,
      size: stat.size,
    });
  }

  return results;
};

/**
 * SHA-256 hash of a content string.
 */
const contentHash = (content) => {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
};

/**
 * Map file extension to language name.
 */
const getLanguage = (ext) => {
  if (!ext) return null;
  const normalized = ext.startsWith(".")
    ? ext.toLowerCase()
    : "." + ext.toLowerCase();
  return EXT_LANG[normalized] || null;
};

/**
 * Check if a file path refers to a source file.
 */
const isSourceFile = (filePath) => {
  return getLanguage(path.extname(filePath)) !== null;
};

module.exports = {
  stripComments,
  walkSourceFiles,
  contentHash,
  getLanguage,
  isSourceFile,
};
