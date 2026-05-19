#Requires -Version 5.1
<#
.SYNOPSIS
    Deploys Claude Code harness configuration from this repo to ~/.claude/

.DESCRIPTION
    Copies hooks, rules, commands, and agents from the repository to the
    user's ~/.claude/ directory. Merges settings.json hooks without
    overwriting existing env vars or plugins.

.PARAMETER DryRun
    Show what would be deployed without making changes.

.PARAMETER Force
    Overwrite existing files without prompting.

.EXAMPLE
    .\deploy.ps1              # Interactive deploy
    .\deploy.ps1 -DryRun      # Preview only
    .\deploy.ps1 -Force       # Deploy without prompts
#>

param(
    [switch]$DryRun,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# --- Paths ---
$RepoRoot = $PSScriptRoot
$ClaudeDir = Join-Path $env:USERPROFILE ".claude"

$Components = @(
    @{ Name = "hooks";    Src = "hooks";    Dest = "hooks";    Filter = "*.js"  },
    @{ Name = "rules";    Src = "rules";    Dest = "rules";    Filter = "*.md"  },
    @{ Name = "commands"; Src = "commands"; Dest = "commands"; Filter = "*.md"  },
    @{ Name = "agents";   Src = "agents";   Dest = "agents";   Filter = "*.md"  }
)

function Write-Status($msg) { Write-Host "[DEPLOY] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)     { Write-Host "[OK]     $msg" -ForegroundColor Green }
function Write-Warn($msg)   { Write-Host "[WARN]   $msg" -ForegroundColor Yellow }
function Write-Fail($msg)   { Write-Host "[FAIL]   $msg" -ForegroundColor Red }

# --- Pre-checks ---
if (-not (Test-Path $ClaudeDir)) {
    Write-Fail "~/.claude/ not found. Is Claude Code installed?"
    exit 1
}

$SettingsFile = Join-Path $ClaudeDir "settings.json"
if (-not (Test-Path $SettingsFile)) {
    Write-Warn "settings.json not found. A template will be created."
}

# --- Deploy files ---
$totalCopied = 0

foreach ($comp in $Components) {
    $srcDir = Join-Path $RepoRoot $comp.Src
    $destDir = Join-Path $ClaudeDir $comp.Dest

    if (-not (Test-Path $srcDir)) {
        Write-Warn "$($comp.Name): source directory not found, skipping"
        continue
    }

    if (-not (Test-Path $destDir)) {
        if ($DryRun) {
            Write-Status "Would create: $destDir"
        } else {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
    }

    $files = Get-ChildItem -Path $srcDir -Filter $comp.Filter -Recurse
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($srcDir.Length + 1)
        $destPath = Join-Path $destDir $relativePath
        $destParent = Split-Path $destPath -Parent

        if (-not (Test-Path $destParent)) {
            if ($DryRun) {
                Write-Status "Would create: $destParent"
            } else {
                New-Item -ItemType Directory -Path $destParent -Force | Out-Null
            }
        }

        $shouldCopy = $false
        if ((Test-Path $destPath)) {
            $srcHash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash
            $destHash = (Get-FileHash $destPath -Algorithm SHA256).Hash
            if ($srcHash -ne $destHash) {
                if ($Force) {
                    $shouldCopy = $true
                } elseif (-not $DryRun) {
                    $answer = Read-Host "Overwrite $($comp.Name)/$relativePath? [y/N]"
                    $shouldCopy = ($answer -eq 'y')
                }
            }
        } else {
            $shouldCopy = $true
        }

        if ($shouldCopy -or $DryRun) {
            if ($DryRun) {
                Write-Status "Would copy: $($comp.Name)/$relativePath"
            } else {
                Copy-Item $file.FullName -Destination $destPath -Force
                Write-Ok "$($comp.Name)/$relativePath"
            }
            $totalCopied++
        }
    }
}

# --- Merge settings.json hooks ---
$TemplateSettings = Join-Path $RepoRoot "settings.template.json"
if (Test-Path $TemplateSettings) {
    Write-Status "Merging hook registrations into settings.json..."

    if ($DryRun) {
        Write-Status "Would merge hooks from template"
    } else {
        # Read existing settings
        $settings = Get-Content $SettingsFile -Raw | ConvertFrom-Json
        $template = Get-Content $TemplateSettings -Raw | ConvertFrom-Json

        # Merge hooks section
        if (-not $settings.hooks) {
            $settings | Add-Member -NotePropertyName "hooks" -NotePropertyValue $template.hooks
        } else {
            foreach ($prop in $template.hooks.PSObject.Properties) {
                $eventName = $prop.Name
                $templateHooks = $prop.Value

                if (-not $settings.hooks.PSObject.Properties.Name.Contains($eventName)) {
                    # New event — add it
                    $settings.hooks | Add-Member -NotePropertyName $eventName -NotePropertyValue $templateHooks
                    Write-Ok "Added event: $eventName"
                } else {
                    # Merge hook entries for existing event
                    $existingHooks = $settings.hooks.$eventName
                    foreach ($entry in $templateHooks) {
                        $matcher = $entry.matcher
                        $existingMatch = $existingHooks | Where-Object { $_.matcher -eq $matcher }

                        if (-not $existingMatch) {
                            # New matcher — add it
                            $existingHooks += $entry
                            $settings.hooks.$eventName = $existingHooks
                            Write-Ok "Added matcher '$matcher' to $eventName"
                        }
                    }
                }
            }
        }

        # Write back
        $settings | ConvertTo-Json -Depth 10 | Set-Content $SettingsFile -Encoding UTF8
        Write-Ok "settings.json hooks merged"
    }
}

# --- Summary ---
if ($DryRun) {
    Write-Host ""
    Write-Status "Dry run complete. $totalCopied files would be deployed."
    Write-Status "Run without -DryRun to apply."
} else {
    Write-Host ""
    Write-Ok "Deploy complete. $totalCopied files deployed."
    Write-Host ""
    Write-Status "Next steps:"
    Write-Host "  1. Review settings.json for hooks and env vars"
    Write-Host "  2. Run /harness-check to verify everything"
    Write-Host "  3. Install plugins: /plugin install <name>"
}
