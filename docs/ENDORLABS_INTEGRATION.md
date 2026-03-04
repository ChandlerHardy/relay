# Endor Labs Integration - Relay Security Scanner

## Overview

Relay now integrates **Endor Labs MCP server** to provide real-time security scanning during AI-assisted coding tasks.

## What This Does

When you run Relay with a task, it now:

1. **Automatically installs** Endor Labs MCP if not present
2. **Injects security instructions** into the AI prompt
3. **Enables security tools** for Claude Code to use during code generation
4. **Scans for vulnerabilities** in dependencies and code changes

## How It Works

### Automatic Installation

```bash
relay --workdir ~/repos/dev1/pb-api --task "Review the iOS filter"
```

**First run:**
```
⚠️  Endor Labs MCP not found, installing...
🔒 Installing Endor Labs MCP security scanner...
✅ Endor Labs MCP installed successfully
```

**Subsequent runs:**
```
✅ Endor Labs MCP already installed
```

### Security Prompt Injection

Relay automatically adds this to every task:

```
## Security Scanning

Endor Labs MCP server is available for security analysis:
- Use it to check dependencies for vulnerabilities
- Scan code for security issues before suggesting changes
- Verify no credentials or secrets are being introduced
```

### What Gets Scanned

Claude Code can now use Endor Labs tools to check:

- **Dependencies** - Vulnerabilities in npm, pip, composer, go modules
- **Code changes** - Security issues in proposed code
- **Secrets** - Accidentally committed credentials
- **Malware** - Suspicious package dependencies

## Architecture

```
┌─────────────┐
│   Relay     │
└──────┬──────┘
       │
       ├─► Load context (skills + PARA)
       │
       ├─► Install Endor Labs MCP (if needed)
       │
       ├─► Inject security instructions
       │
       └─► Launch Claude Code with MCP
              │
              ├─► Endor Labs tools available
              ├─► Security scanning during coding
              └─► Vulnerability checking
```

## Files Modified

1. **relay/endorlabs.go** - Endor Labs MCP manager
2. **relay/orchestrator.go** - Integration with Claude Code
3. **go.mod** - Dependencies updated

## Installation (Manual)

If you want to install Endor Labs MCP manually without Relay:

```bash
claude mcp add endor-cli-tools -- npx -y endorctl ai-tools mcp-server
```

This will:
- Open a browser for Google authentication
- Add the MCP server to `~/.claude/mcp.json`
- Make Endor Labs tools available in all Claude Code sessions

## Verification

Check if Endor Labs MCP is installed:

```bash
claude mcp list
```

Should show:
```
endor-cli-tools: npx -y endorctl ai-tools mcp-server - ✓ Connected
```

## Benefits

**Before Relay + Endor Labs:**
- Claude Code generates code
- You review manually for security issues
- Vulnerabilities discovered later (or in production)

**After Relay + Endor Labs:**
- Relay injects your context and patterns
- Claude Code generates code
- Endor Labs scans for vulnerabilities automatically
- Security issues caught before commit
- Dependencies checked for known CVEs

## Example Workflow

```bash
# Task: Add a new dependency
relay --workdir ~/repos/myproject --task "Add express for HTTP routing"

# What happens:
# 1. Relay detects Node.js project
# 2. Loads Node.js patterns from skills
# 3. Installs Endor Labs MCP (if needed)
# 4. Claude Code gets task + security instructions
# 5. Claude Code uses Endor Labs to check express for vulnerabilities
# 6. Shows you: "express 4.19.2 has 2 known vulnerabilities"
# 7. Suggests safer alternative or patch version
```

## Cost

**Endor Labs Developer Edition: FREE**

- No credit card required
- Just Google authentication
- Full MCP access
- Unlimited local scans

## Next Steps

Once Go is installed and Relay is tested:

1. Run Relay on a real task
2. Verify Endor Labs MCP is active
3. Check that security scanning works
4. Document any issues

## Troubleshooting

### Endor Labs fails to install

```bash
# Install manually
claude mcp add endor-cli-tools -- npx -y endorctl ai-tools mcp-server
```

### MCP server not connecting

```bash
# Check MCP status
claude mcp list

# Restart Claude Code
killall claude
```

### Not scanning dependencies

Make sure the prompt includes security instructions. Relay adds them automatically, but verify in the generated prompt file.

---

**Status:** ✅ Code written, awaiting Go install to test
**Last updated:** 2026-03-04
**By:** Rook 🐦‍⬛
