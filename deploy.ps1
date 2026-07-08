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

.PARAMETER Mini
    Deploy compressed rules (saves ~17% tokens).

.PARAMETER Full
    Deploy full rules with detailed examples.

.EXAMPLE
    .\deploy.ps1              # Interactive deploy (prompts for mode)
    .\deploy.ps1 -DryRun      # Preview only
    .\deploy.ps1 -Force       # Deploy without prompts (defaults to mini)
    .\deploy.ps1 -Mini        # Deploy with compressed rules
    .\deploy.ps1 -Full        # Deploy with full rules
#>

param(
    [switch]$DryRun,
    [switch]$Force,
    [switch]$Mini,
    [switch]$Full
)

$ErrorActionPreference = "Stop"

# --- Logging helpers (defined early so the mode block below can use them) ---
function Write-Status($msg) { Write-Host "[DEPLOY] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)     { Write-Host "[OK]     $msg" -ForegroundColor Green }
function Write-Warn($msg)   { Write-Host "[WARN]   $msg" -ForegroundColor Yellow }
function Write-Fail($msg)   { Write-Host "[FAIL]   $msg" -ForegroundColor Red }

# --- Determine mode ---
$useMini = $null
if ($Mini -and $Full) {
    Write-Fail "Cannot specify both -Mini and -Full"
    exit 1
} elseif ($Mini) {
    $useMini = $true
} elseif ($Full) {
    $useMini = $false
} elseif (-not $Force -and -not $DryRun) {
    # Interactive mode selection
    Write-Host ""
    Write-Host "Select deployment mode:" -ForegroundColor Cyan
    Write-Host "  1) full  - Complete rules with detailed examples (baseline)" -ForegroundColor White
    Write-Host "  2) mini  - Compressed rules, ~17% token savings (daily dev)" -ForegroundColor White
    Write-Host ""
    $choice = Read-Host "Choose mode [1/2, default: 2]"
    switch ($choice) {
        "1" { $useMini = $false; Write-Host "[DEPLOY] Mode: full" -ForegroundColor Cyan }
        "2" { $useMini = $true; Write-Host "[DEPLOY] Mode: mini" -ForegroundColor Cyan }
        "" { $useMini = $true; Write-Host "[DEPLOY] Mode: mini (default)" -ForegroundColor Cyan }
        default { Write-Warn "Invalid choice, defaulting to mini"; $useMini = $true }
    }
    Write-Host ""
} elseif ($Force) {
    # Default to mini when forced without explicit choice
    $useMini = $true
}

# Default to mini for any remaining unset path (e.g. -DryRun without -Mini/-Full),
# so preview and apply always select the same mode.
if ($null -eq $useMini) { $useMini = $true }

# --- Paths ---
$RepoRoot = $PSScriptRoot
$ClaudeDir = Join-Path $env:USERPROFILE ".claude"

# Determine rules source based on mode
if ($useMini -eq $true) {
    $rulesSrc = "rules-mini"
    Write-Host "[DEPLOY] Using compressed rules (mini mode, ~17% token savings)" -ForegroundColor Cyan
} else {
    $rulesSrc = "rules"
    Write-Host "[DEPLOY] Using full rules (complete guidelines)" -ForegroundColor Cyan
}

$Components = @(
    @{ Name = "hooks";    Src = "hooks";    Dest = "hooks";    Filter = "*.js"  },
    @{ Name = "rules";    Src = $rulesSrc;  Dest = "rules";    Filter = "*.md"  },
    @{ Name = "commands"; Src = "commands"; Dest = "commands"; Filter = "*.md"  },
    @{ Name = "agents";   Src = "agents";   Dest = "agents";   Filter = "*.md"  }
)

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
            $sha = [System.Security.Cryptography.SHA256]::Create()
            $srcHash = [BitConverter]::ToString($sha.ComputeHash([System.IO.File]::ReadAllBytes($file.FullName))) -replace '-',''
            $destHash = [BitConverter]::ToString($sha.ComputeHash([System.IO.File]::ReadAllBytes($destPath))) -replace '-',''
            $sha.Dispose()
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

        # Merge mcpServers section
        if ($template.mcpServers) {
            if (-not $settings.mcpServers) {
                $settings | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue $template.mcpServers
                Write-Ok "Added mcpServers section"
            } else {
                foreach ($prop in $template.mcpServers.PSObject.Properties) {
                    if (-not $settings.mcpServers.PSObject.Properties.Name.Contains($prop.Name)) {
                        $settings.mcpServers | Add-Member -NotePropertyName $prop.Name -NotePropertyValue $prop.Value
                        Write-Ok "Added MCP server: $($prop.Name)"
                    }
                }
            }
        }

        # Merge new permissions
        if ($template.permissions -and $template.permissions.allow) {
            if (-not $settings.permissions) {
                $settings | Add-Member -NotePropertyName "permissions" -NotePropertyValue $template.permissions
            } elseif (-not $settings.permissions.allow) {
                $settings.permissions | Add-Member -NotePropertyName "allow" -NotePropertyValue $template.permissions.allow
            } else {
                $existingAllow = $settings.permissions.allow
                foreach ($perm in $template.permissions.allow) {
                    if ($existingAllow -notcontains $perm) {
                        $existingAllow += $perm
                        Write-Ok "Added permission: $perm"
                    }
                }
                $settings.permissions.allow = $existingAllow
            }
        }

        # Write back (UTF8 without BOM)
        $jsonOutput = $settings | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($SettingsFile, $jsonOutput, [System.Text.UTF8Encoding]::new($false))
        Write-Ok "settings.json hooks merged"
    }
}

# --- Stage both rule sets + record chosen mode so the post-deploy switcher works ---
$chosenMode = if ($useMini -eq $true) { "mini" } else { "full" }
if ($DryRun) {
    Write-Status "Would stage rules-full/rules-mini references + write harness-mode.json (mode: $chosenMode)"
} else {
    $rulesFullDir = Join-Path $ClaudeDir "rules-full"
    $rulesMiniDir = Join-Path $ClaudeDir "rules-mini"
    New-Item -ItemType Directory -Path $rulesFullDir -Force | Out-Null
    New-Item -ItemType Directory -Path $rulesMiniDir -Force | Out-Null
    Copy-Item -Path (Join-Path $RepoRoot "rules\*") -Destination $rulesFullDir -Recurse -Force
    Copy-Item -Path (Join-Path $RepoRoot "rules-mini\*") -Destination $rulesMiniDir -Recurse -Force
    $modeConfig = [PSCustomObject]@{ mode = $chosenMode; note = "Managed by switch-harness-mode.js" }
    $modeConfig | ConvertTo-Json | Set-Content -Path (Join-Path $ClaudeDir "harness-mode.json") -Encoding UTF8
    Write-Ok "Staged rules-full/ + rules-mini/ references (mode: $chosenMode)"
}

# --- Summary ---
if ($DryRun) {
    Write-Host ""
    Write-Status "Dry run complete. $totalCopied files would be deployed."
    if ($useMini -eq $true) { Write-Status "Mode: mini (compressed rules)" }
    Write-Status "Run without -DryRun to apply."
} else {
    Write-Host ""
    Write-Ok "Deploy complete. $totalCopied files deployed."
    Write-Host ""
    if ($useMini -eq $true) {
        Write-Status "Deployed with compressed rules (mini mode)"
    } else {
        Write-Status "Deployed with full rules"
    }
    Write-Host ""
    Write-Status "Next steps:"
    Write-Host "  1. Review settings.json for hooks and env vars"
    Write-Host "  2. Run /harness-check to verify everything"
    Write-Host "  3. Install plugins: /plugin install <name>"
    Write-Host ""
    Write-Host "To switch modes later (no re-deploy needed):"
    Write-Host "  node ~/.claude/hooks/switch-harness-mode.js [mini|full]"
    Write-Host "  (run without arguments to print current mode)"
}
