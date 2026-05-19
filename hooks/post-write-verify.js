/**
 * Post-Write Verification Hook
 * Runs lint checks (ruff/eslint) after Write/Edit on source files.
 * Non-blocking: only warns, never prevents the write.
 * Timeout: 10s per check to avoid blocking the session.
 */

const TIMEOUT_MS = 10_000;
const SOURCE_EXTENSIONS = new Set([
  '.py', '.pyx', '.pyi',
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.rs', '.go', '.java', '.kt',
]);

function getFileExtension(filePath) {
  const dot = filePath.lastIndexOf('.');
  return dot >= 0 ? filePath.slice(dot).toLowerCase() : '';
}

function findProjectRoot(filePath) {
  const path = require('path');
  let dir = path.dirname(filePath);
  for (let i = 0; i < 10; i++) {
    if (
      require('fs').existsSync(path.join(dir, 'pyproject.toml')) ||
      require('fs').existsSync(path.join(dir, 'package.json')) ||
      require('fs').existsSync(path.join(dir, 'Cargo.toml'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function execWithTimeout(cmd, cwd) {
  const { execSync } = require('child_process');
  try {
    const result = execSync(cmd, {
      cwd,
      timeout: TIMEOUT_MS,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return { ok: true, output: result };
  } catch (e) {
    const stdout = e.stdout || '';
    const stderr = e.stderr || '';
    const output = (stdout + '\n' + stderr).trim();
    if (e.killed) {
      return { ok: false, output: 'Verification timed out' };
    }
    return { ok: false, output };
  }
}

function verifyPython(filePath) {
  const root = findProjectRoot(filePath);
  const cwd = root || require('path').dirname(filePath);
  const checks = [];

  // Ruff lint
  const ruff = execWithTimeout(`ruff check "${filePath}" --output-format=concise`, cwd);
  if (!ruff.ok) {
    const lines = ruff.output.split('\n').filter(l => l.trim());
    const summary = lines.slice(0, 5).join('\n');
    const extra = lines.length > 5 ? `\n... and ${lines.length - 5} more` : '';
    checks.push(`[VERIFY FAILED] ruff found ${lines.length} issue(s):\n${summary}${extra}`);
  }

  return checks;
}

function verifyTypeScript(filePath) {
  const root = findProjectRoot(filePath);
  if (!root) return [];
  const fs = require('fs');
  const path = require('path');
  const checks = [];

  // Check for eslint config
  const eslintConfigs = ['.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', 'eslint.config.js', 'eslint.config.mjs'];
  const hasEslint = eslintConfigs.some(f => fs.existsSync(path.join(root, f)));

  if (hasEslint) {
    const eslint = execWithTimeout(`npx eslint "${filePath}" --no-color`, root);
    if (!eslint.ok && eslint.output) {
      const lines = eslint.output.split('\n').filter(l => l.trim());
      const summary = lines.slice(0, 5).join('\n');
      checks.push(`[VERIFY FAILED] eslint found issue(s):\n${summary}`);
    }
  }

  return checks;
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const filePath = data?.tool_input?.file_path || data?.tool_input?.path || '';
      if (!filePath) return;

      const ext = getFileExtension(filePath);
      if (!SOURCE_EXTENSIONS.has(ext)) return;

      const warnings = [];

      if (ext === '.py' || ext === '.pyx' || ext === '.pyi') {
        warnings.push(...verifyPython(filePath));
      } else if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        warnings.push(...verifyTypeScript(filePath));
      }

      if (warnings.length > 0) {
        process.stderr.write(`\n${warnings.join('\n\n')}\n`);
      }
    } catch {
      // Silent fail — never block the workflow
    }
  });
}

main();
