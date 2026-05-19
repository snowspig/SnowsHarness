/**
 * Session Start Hook
 *
 * On each new Claude Code session, this hook:
 * 1. Shows a brief environment status (NadirClaw, vLLM)
 * 2. Detects project type and loads relevant rules
 * 3. Shows enriched workspace briefing (key files, commands, git info, memory)
 * 4. Auto-initializes MEMORY.md if the project's memory directory lacks it
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");

function fetchJSON(url, timeout = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

function detectProjectType(cwd) {
  const indicators = [
    {
      type: "Python",
      files: ["pyproject.toml", "setup.py", "requirements.txt", "setup.cfg"],
    },
    {
      type: "Frontend",
      files: [
        "package.json",
        "tsconfig.json",
        "vite.config.ts",
        "next.config.js",
      ],
    },
    { type: "Django", files: ["manage.py", "django"] },
    { type: "FastAPI", files: ["main.py"] },
    { type: "Rust", files: ["Cargo.toml"] },
    { type: "Go", files: ["go.mod"] },
  ];

  const detected = [];
  for (const { type, files } of indicators) {
    for (const file of files) {
      if (fs.existsSync(path.join(cwd, file))) {
        if (!detected.includes(type)) detected.push(type);
      }
    }
  }
  return detected.length > 0 ? detected : ["Unknown"];
}

function checkCLAUDE_MD(cwd) {
  const locations = [
    path.join(cwd, "CLAUDE.md"),
    path.join(cwd, ".claude", "CLAUDE.md"),
  ];
  return locations.find((p) => fs.existsSync(p)) || null;
}

/**
 * Detect likely commands from project configuration files
 */
function detectCommands(cwd) {
  const commands = [];

  try {
    // Python: pyproject.toml scripts
    const pyprojectPath = path.join(cwd, "pyproject.toml");
    if (fs.existsSync(pyprojectPath)) {
      const content = fs.readFileSync(pyprojectPath, "utf8");
      if (content.includes("pytest")) commands.push("pytest");
      if (content.includes("ruff")) commands.push("ruff check");
      if (content.includes("mypy")) commands.push("mypy");
      if (content.includes("python")) commands.push("python");
    }

    // Python: setup.py
    if (fs.existsSync(path.join(cwd, "setup.py"))) {
      commands.push("python setup.py");
    }

    // Frontend: package.json scripts
    const packagePath = path.join(cwd, "package.json");
    if (fs.existsSync(packagePath)) {
      const content = fs.readFileSync(packagePath, "utf8");
      const pkg = JSON.parse(content);

      if (pkg.scripts) {
        if (pkg.scripts.test) commands.push("npm test");
        if (pkg.scripts.build) commands.push("npm run build");
        if (pkg.scripts.dev || pkg.scripts.start) commands.push("npm run dev");
        if (pkg.scripts.lint) commands.push("npm run lint");
      }

      if (pkg.devDependencies) {
        if (pkg.devDependencies.vitest || pkg.dependencies.vitest)
          commands.push("vitest");
        if (pkg.devDependencies.jest || pkg.dependencies.jest)
          commands.push("jest");
        if (pkg.devDependencies.eslint || pkg.dependencies.eslint)
          commands.push("eslint");
        if (pkg.devDependencies.prettier || pkg.dependencies.prettier)
          commands.push("prettier");
      }
    }

    // Makefile
    if (fs.existsSync(path.join(cwd, "Makefile"))) {
      commands.push("make");
    }

    // Docker
    if (
      fs.existsSync(path.join(cwd, "Dockerfile")) ||
      fs.existsSync(path.join(cwd, "docker-compose.yml"))
    ) {
      commands.push("docker");
    }
  } catch {
    // Silent fail on parse errors
  }

  return [...new Set(commands)]; // Dedupe
}

/**
 * Get recent git commits if in a git repo
 */
function getGitInfo(cwd) {
  try {
    // Check if we're in a git repo
    execSync("git rev-parse --git-dir", { cwd, stdio: "ignore" });

    // Get last 3 commits
    const log = execSync('git log -3 --format="%h %s (%cr)"', {
      cwd,
      encoding: "utf8",
    });
    const commits = log.trim().split("\n");

    return { repo: true, commits };
  } catch {
    return { repo: false, commits: [] };
  }
}

function ageDays(filepath) {
  try {
    const mtime = fs.statSync(filepath).mtime;
    return Math.floor((Date.now() - mtime) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Check for project memory files and surface relevant entries
 */
function checkMemory(cwd) {
  const memoryDirs = [
    path.join(cwd, ".claude", "memory"),
    path.join(cwd, "memory"),
  ];

  const found = [];

  for (const memDir of memoryDirs) {
    if (fs.existsSync(memDir)) {
      try {
        const files = fs.readdirSync(memDir).filter((f) => f.endsWith(".md"));
        if (files.length > 0) {
          // Get most recent files by mtime
          const withStats = files.map((f) => ({
            name: f,
            mtime: fs.statSync(path.join(memDir, f)).mtime,
            path: path.join(memDir, f),
          }));
          withStats.sort((a, b) => b.mtime - a.mtime);

          // Return top 3 most recent
          for (const item of withStats.slice(0, 3)) {
            const daysAgo = Math.floor(
              (Date.now() - item.mtime) / (1000 * 60 * 60 * 24),
            );
            const ageStr =
              daysAgo === 0
                ? "today"
                : daysAgo === 1
                  ? "yesterday"
                  : `${daysAgo} days ago`;
            found.push({ name: item.name, age: ageStr, path: item.path });
          }
        }
      } catch {
        // Continue
      }
    }
  }

  return found;
}

/**
 * Extract key snippets from memory files for session-start display
 */
function extractMemorySnippets(memories) {
  const snippets = [];

  for (const mem of memories.slice(0, 2)) {
    // Only read top 2
    try {
      const content = fs.readFileSync(mem.path, "utf8");
      const lines = content.split("\n");

      // Extract first few meaningful lines (skip headers, empty lines)
      let count = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (
          trimmed.length > 15 &&
          !trimmed.startsWith("#") &&
          !trimmed.startsWith(">")
        ) {
          snippets.push(
            `  ${trimmed.slice(0, 80)}${trimmed.length > 80 ? "..." : ""}`,
          );
          count++;
          if (count >= 2) break;
        }
      }
    } catch {
      // Continue
    }
  }

  return snippets;
}

/**
 * Find the project's memory directory under ~/.claude/projects/
 * Matches cwd to the correct project directory by normalizing the path.
 */
function findProjectMemoryDir(cwd) {
  const home = process.env.USERPROFILE || process.env.HOME;
  const projectsDir = path.join(home, ".claude", "projects");
  if (!fs.existsSync(projectsDir)) return null;

  // Normalize cwd to match directory naming: D:\Quant\Foo -> D--Quant-Foo
  const cwdNormalized = cwd
    .replace(/\\/g, "-")
    .replace(/:/g, "")
    .replace(/\/$/, "");
  const directMatch = path.join(projectsDir, cwdNormalized, "memory");
  if (fs.existsSync(directMatch)) return directMatch;

  // Fallback: case-insensitive match
  const cwdLower = cwdNormalized.toLowerCase();
  try {
    const dirs = fs.readdirSync(projectsDir);
    for (const dir of dirs) {
      if (dir.toLowerCase() === cwdLower) {
        const memDir = path.join(projectsDir, dir, "memory");
        if (fs.existsSync(memDir)) return memDir;
      }
    }
  } catch {
    /* silent */
  }
  return null;
}

/**
 * Auto-initialize MEMORY.md if the memory directory exists but lacks it.
 * Returns true if a new file was created, false otherwise.
 */
function ensureMemoryInit(memoryDir) {
  if (!memoryDir) return false;
  const memoryMd = path.join(memoryDir, "MEMORY.md");
  if (fs.existsSync(memoryMd)) return false;

  const projectName = path
    .basename(path.dirname(memoryDir))
    .replace(/^D--/, "")
    .replace(/-/g, "/");

  const template = [
    `# ${projectName} Memory`,
    "",
    "## Active Context",
    "_No active context yet._",
    "",
    "## Wings",
    "| Wing | Items | Last Updated |",
    "|------|-------|-------------|",
    "_(no wings yet)_",
    "",
  ].join("\n");

  try {
    fs.writeFileSync(memoryMd, template, "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Memory Palace — find the project's memory directory with wings/ structure
 */
function findMemoryPalaceDir(cwd) {
  const home = process.env.USERPROFILE || process.env.HOME;
  const claudeProjectsDir = path.join(home, ".claude", "projects");
  if (!fs.existsSync(claudeProjectsDir)) return null;

  const cwdLower = cwd.toLowerCase().replace(/\\/g, "/");
  try {
    const dirs = fs.readdirSync(claudeProjectsDir);
    for (const dir of dirs) {
      const memoryDir = path.join(claudeProjectsDir, dir, "memory");
      if (fs.existsSync(path.join(memoryDir, "wings"))) {
        // Check if project hash matches cwd
        if (
          cwdLower.includes(dir.split("-").pop().toLowerCase()) ||
          dir.includes("D--Quant")
        ) {
          return memoryDir;
        }
      }
    }
    // Fallback: return any project dir with wings/
    for (const dir of dirs) {
      const memoryDir = path.join(claudeProjectsDir, dir, "memory");
      if (fs.existsSync(path.join(memoryDir, "wings"))) {
        return memoryDir;
      }
    }
  } catch {
    /* silent */
  }
  return null;
}

/**
 * Memory Palace — extract top facts from a facts.md file
 * Prioritizes ★ critical facts, then by date descending
 */
function extractTopFacts(factsPath, maxCount) {
  try {
    const content = fs.readFileSync(factsPath, "utf8");
    const facts = [];
    const sections = content.split(/^## /m);

    for (const section of sections.slice(1)) {
      const lines = section.split("\n").filter((l) => l.trim());
      if (lines.length === 0) continue;

      const title = lines[0].trim();
      const isCritical =
        section.includes("★") || section.includes("Status: critical");
      const dateMatch = section.match(/\*\*Date\*\*:\s*(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : "0000-00-00";

      // Skip title line (lines[0]), then filter metadata and empty lines
      const contentLines = lines.slice(1).filter((l) => {
        const trimmed = l.trim();
        return (
          !trimmed.startsWith("- **Date**") &&
          !trimmed.startsWith("- **Status**") &&
          trimmed.length > 5
        );
      });
      const summary = contentLines[0]
        ? contentLines[0]
            .trim()
            .replace(/^[-*]\s*/, "")
            .slice(0, 80)
        : title;

      facts.push({ title, summary, isCritical, date });
    }

    facts.sort((a, b) => {
      if (a.isCritical !== b.isCritical) return b.isCritical - a.isCritical;
      return b.date.localeCompare(a.date);
    });

    return facts
      .slice(0, maxCount)
      .map((f) => `${f.isCritical ? "★" : " "} ${f.summary}`);
  } catch {
    return [];
  }
}

/**
 * Memory Palace — load L2 context by matching wing keywords
 */
function loadMemoryPalace(cwd, palaceDir) {
  const output = [];
  const wingsDir = path.join(palaceDir, "wings");
  if (!fs.existsSync(wingsDir)) return output;

  // Get wing directories (skip _template)
  const wingDirs = [];
  try {
    const entries = fs.readdirSync(wingsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith("_")) {
        wingDirs.push({
          name: entry.name,
          path: path.join(wingsDir, entry.name),
        });
      }
    }
  } catch {
    /* silent */
  }

  // Build search text: cwd + wing names + CLAUDE.md content
  const cwdParts = cwd.replace(/\\/g, "/").split("/");
  const searchParts = [cwd.toLowerCase(), cwdParts.join(" ")];
  // Wing names themselves are strong signals
  for (const w of wingDirs) searchParts.push(w.name.toLowerCase());
  // Search for CLAUDE.md in cwd and up to 3 parent dirs
  for (let i = 0; i < 4; i++) {
    const d = i === 0 ? cwd : path.resolve(cwd, ...Array(i).fill(".."));
    const md = path.join(d, "CLAUDE.md");
    if (fs.existsSync(md)) {
      try {
        searchParts.push(fs.readFileSync(md, "utf8").toLowerCase());
      } catch {}
      break;
    }
  }
  const searchText = searchParts.join(" ");

  // Match wings by keywords from README.md
  const matchedWings = [];
  for (const wing of wingDirs) {
    const readmePath = path.join(wing.path, "README.md");
    if (!fs.existsSync(readmePath)) continue;
    try {
      const readme = fs.readFileSync(readmePath, "utf8");
      const kwMatch = readme.match(/## Keywords[^\n]*\n(.+)/i);
      if (kwMatch) {
        const keywords = kwMatch[1]
          .toLowerCase()
          .split(",")
          .map((k) => k.trim());
        const matchCount = keywords.filter((kw) =>
          searchText.includes(kw),
        ).length;
        if (matchCount > 0) {
          matchedWings.push({ ...wing, matchCount });
        }
      }
    } catch {
      /* silent */
    }
  }

  matchedWings.sort((a, b) => b.matchCount - a.matchCount);
  const topWings = matchedWings.slice(0, 2);

  if (topWings.length === 0) {
    output.push(
      `  Wings: ${wingDirs.length} available (none matched current project)`,
    );
    return output;
  }

  for (const wing of topWings) {
    output.push(`  [${wing.name}] (${wing.matchCount} keyword matches)`);
    const factsPath = path.join(wing.path, "facts.md");
    if (fs.existsSync(factsPath)) {
      const facts = extractTopFacts(factsPath, 3);
      for (const fact of facts) {
        output.push(`    ${fact}`);
      }
    }
  }

  return output;
}

/**
 * Detect key files in the project
 */
function detectKeyFiles(cwd) {
  const keyFiles = [];

  const importantFiles = [
    "README.md",
    "CONTRIBUTING.md",
    "CHANGELOG.md",
    "LICENSE",
    "Dockerfile",
    "docker-compose.yml",
    ".env.example",
    ".env.template",
    "requirements.txt",
    "pyproject.toml",
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "next.config.js",
  ];

  for (const file of importantFiles) {
    if (fs.existsSync(path.join(cwd, file))) {
      keyFiles.push(file);
    }
  }

  return keyFiles.slice(0, 8); // Limit to 8 files
}

async function main() {
  // Random delay (0-2s) to prevent multiple terminals from hitting health endpoints simultaneously
  const jitter = Math.floor(Math.random() * 2000);
  await new Promise((r) => setTimeout(r, jitter));

  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Auto-initialize MEMORY.md for this project
  const memDir = findProjectMemoryDir(cwd);
  const memoryInit = ensureMemoryInit(memDir);

  // 1. Check services
  const nadirclaw = await fetchJSON("http://localhost:8856/health");
  const vllm = await fetchJSON("http://localhost:8000/v1/models");

  const lines = [];
  lines.push("=== Session Start ===");
  lines.push("");

  // Service status
  lines.push("[Services]");
  if (nadirclaw?.status === "ok") {
    lines.push(
      `  NadirClaw: OK (v${nadirclaw.version}, simple=${nadirclaw.simple_model})`,
    );
  } else {
    lines.push("  NadirClaw: NOT RUNNING - run: nadirclaw serve --verbose");
  }

  if (vllm?.data?.length > 0) {
    const model = vllm.data[0];
    lines.push(`  vLLM: ${model.id} (${model.max_model_len} ctx)`);
  } else {
    lines.push("  vLLM: NOT RUNNING - run: docker start nemotron-supervisor");
  }

  lines.push("");

  // Project detection
  lines.push("[Project]");
  const projectTypes = detectProjectType(cwd);
  lines.push(`  Type: ${projectTypes.join(" + ")}`);
  lines.push(`  Dir: ${cwd}`);

  const claudeMd = checkCLAUDE_MD(cwd);
  if (claudeMd) {
    lines.push(`  CLAUDE.md: ✓`);
  } else {
    lines.push("  CLAUDE.md: ✗ (run /plan-project to generate)");
  }

  lines.push("");

  // Workspace briefing
  lines.push("[Workspace Briefing]");

  // Key files
  const keyFiles = detectKeyFiles(cwd);
  if (keyFiles.length > 0) {
    lines.push(`  Key files: ${keyFiles.join(", ")}`);
  }

  // Likely commands
  const commands = detectCommands(cwd);
  if (commands.length > 0) {
    lines.push(`  Commands: ${commands.slice(0, 6).join(", ")}`);
  }

  // Git info
  const gitInfo = getGitInfo(cwd);
  if (gitInfo.repo && gitInfo.commits.length > 0) {
    lines.push("  Recent commits:");
    gitInfo.commits.slice(0, 3).forEach((commit) => {
      lines.push(`    ${commit}`);
    });
  }

  // Memory status
  if (memDir) {
    const palaceDir = findMemoryPalaceDir(cwd);
    if (palaceDir) {
      const palaceOutput = loadMemoryPalace(cwd, palaceDir);
      lines.push(
        `  Memory: ✓${memoryInit ? " (MEMORY.md auto-initialized)" : ""}`,
      );
      for (const line of palaceOutput) {
        lines.push(line);
      }
    } else {
      lines.push(
        `  Memory: ✓${memoryInit ? " (MEMORY.md auto-initialized)" : ""}`,
      );
    }
  } else {
    lines.push("  Memory: not set up");
  }

  // Available commands
  lines.push("");
  lines.push("[Available Commands]");
  lines.push("  /review         - Code review recent changes");
  lines.push("  /plan-project   - Generate CLAUDE.md for project");
  lines.push("  /health-check   - Full environment health check");

  console.error(lines.join("\n"));

  // Write health cache for session-end.js to read
  const healthCache = {
    nadirclaw: nadirclaw?.status === "ok" ? "ok" : null,
    vllm: vllm?.data?.length > 0 ? "ok" : null,
    checked_at: new Date().toISOString(),
    cwd,
    project_types: projectTypes,
    has_claude_md: !!claudeMd,
  };
  try {
    const cachePath = path.join(
      process.env.USERPROFILE || process.env.HOME,
      ".claude",
      ".session-health-cache.json",
    );
    fs.writeFileSync(cachePath, JSON.stringify(healthCache), "utf8");
  } catch {
    /* silent */
  }
}

main().catch(() => {});
