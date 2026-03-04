# Relay - 13rac1 Orchestrator with Context Injection

**Orchestrate Claude Code containers with your local skills and PARA knowledge base injected.**

---

## What It Does

Relay orchestrates Claude Code/13rac1 containers and injects your project-specific context before the task begins.

**Problem Solved:**
- Isolated containers miss your expertise
- Code reviews don't follow your patterns
- Fixes don't use established conventions
- Repeated back-and-forth to correct issues

**Solution:**
- Detects project type automatically
- Loads project guidelines (`.claude/skills/*-guidelines/`)
- Loads PARA knowledge base (patterns, resources)
- Injects context into Claude Code
- Better results with your expertise

---

## Installation

```bash
# Clone relay repo
cd ~/repos/relay

# Build
go build -o bin/relay ./cmd/relay

# Install (optional)
cp bin/relay /usr/local/bin/relay
```

---

## Usage

### Basic Usage

```bash
# Review code with project context
relay --workdir ~/repos/dev1/pb-api \
  --task "Review api/protocol_routes.go for iOS 3.x compatibility"

# Implement feature with guidelines
relay --workdir ~/repos/triagebox \
  --task "Add PostHog analytics following frontend-dev-guidelines"

# Fix bug with patterns
relay --workdir ~/repos/dev0/pb-www \
  --task "Fix the pagination issue in phplib/local/Report.php"
```

### Using Prompt Files

```bash
# Create detailed prompt
cat > /tmp/task.txt << 'EOF'
Review the iOS filter implementation in api/protocol_routes.go:
1. Follow pb-www-guidelines if available
2. Use 8-agent enhanced review process
3. Check for CRUD parity
4. Verify behavioral changes
EOF

# Run with prompt file
relay --workdir ~/repos/dev1/pb-api --task @/tmp/task.txt
```

---

## What Gets Loaded

### Project Skills (if `.claude/skills/` exists)

Relay finds all `*-guidelines.md` or `*-guidelines/SKILL.md` files:

- `pb-www-guidelines` — Performance Beef PHP patterns
- `backend-dev-guidelines` — Node.js/Express patterns
- `frontend-dev-guidelines` — React/MUI patterns
- `php-backend-dev-guidelines` — PHP/MongoDB patterns
- `triagebox-guidelines` — TriageBox-specific patterns
- Plus any project-specific guidelines

### PARA Knowledge Base

If `~/repos/notes` exists, Relay loads:

- `areas/recurring-patterns.md` — Automation opportunities
- `resources/dev-docs/design-patterns/SKILL.md` — Architecture patterns (Go/Node)
- Other relevant context

### Project Type Detection

Relay automatically detects:

- **PHP:** `phplib/` directory exists
- **Go:** `go.mod` file exists
- **Python:** `pyproject.toml` file exists
- **Node:** `package.json` file exists

---

## Examples

### Example 1: Work Code Review

```bash
relay --workdir ~/repos/dev1/pb-api \
  --task "Review the iOS filter implementation. Follow pb-www-guidelines."
```

**What happens:**
1. Detects: PHP project (phplib/ exists)
2. Loads: pb-www-guidelines from .claude/skills/
3. Loads: PARA patterns and design patterns
4. Injects: All context into Claude Code
5. Result: Better review with your expertise

---

### Example 2: Personal Project

```bash
relay --workdir ~/repos/triagebox \
  --task "Add Sentry error tracking to the Next.js frontend"
```

**What happens:**
1. Detects: Node project (package.json exists)
2. Loads: triagebox-guidelines if available
3. Loads: frontend-dev-guidelines from local skills
4. Loads: PARA design patterns
5. Injects: All context into Claude Code
6. Result: Implementation follows your patterns

---

### Example 3: Detailed Task File

```bash
cat > /tmp/review.txt << 'EOF'
Code Review Task: iOS Filter Implementation

File: api/protocol_routes.go

Focus Areas:
1. Follow pb-www-guidelines patterns
2. Use 8-agent enhanced review process
3. Check for CRUD parity
4. Verify iOS 3.x user agent handling
5. Look for refactoring opportunities

Please provide:
- Overall assessment
- Specific issues found
- Recommended fixes
- Risk level (1-100)
EOF

relay --workdir ~/repos/dev1/pb-api --task @/tmp/review.txt
```

---

## Architecture

```
User Request → Relay CLI
                  ↓
    ┌─────────────────────────────┐
    │ Detect Project Type          │
    │ (PHP? Go? Python? Node?)      │
    └─────────────────────────────┘
                  ↓
    ┌─────────────────────────────┐
    │ Load Project Skills          │
    │ (.claude/skills/*-guidelines) │
    └─────────────────────────────┘
                  ↓
    ┌─────────────────────────────┐
    │ Load PARA Context            │
    │ (patterns, design, resources) │
    └─────────────────────────────┘
                  ↓
    ┌─────────────────────────────┐
    │ Build Prompt with Context    │
    │ (guidelines + patterns + task)│
    └─────────────────────────────┘
                  ↓
    ┌─────────────────────────────┐
    │ Run Claude Code Container    │
    │ (with your context injected!) │
    └─────────────────────────────┘
                  ↓
    User reviews results → Applies changes
```

---

## Why Relay?

**Without Relay:**
```
Claude Code container (isolated)
↓
Works on code without your patterns
↓
Misses project-specific conventions
↓
Requires back-and-forth to fix
```

**With Relay:**
```
Claude Code container + Your Context
↓
Works on code WITH your patterns
↓
Follows project conventions
↓
Better results, faster
```

---

## Security Integration 🔒

**Endor Labs MCP Server — Real-time Security Scanning**

Relay now includes **automatic Endor Labs integration** for vulnerability scanning during AI-assisted coding.

**What it does:**
- Automatically installs Endor Labs MCP on first run
- Injects security instructions into every task
- Enables Claude Code to scan for:
  - Dependency vulnerabilities (npm, pip, composer, go)
  - Code security issues
  - Accidentally committed secrets
  - Malicious packages

**Usage:**
```bash
relay --workdir ~/repos/myproject --task "Add express for HTTP"
# Endor Labs automatically checks express for known vulnerabilities
```

**Cost:** FREE (Developer Edition)
**Documentation:** See `docs/ENDORLABS_INTEGRATION.md`

---

## Current Status

✅ **v0.1.0 — CLI Tool (Phase 1 Complete)**

**Implemented:**
- Project type detection (PHP/Go/Python/Node)
- Context loading (project skills + PARA)
- Claude Code orchestration
- Prompt file support
- Interactive mode
- **Endor Labs security scanning** ✨

**Next Steps (Phase 2):**
- Background mode
- OpenClaw skill wrapper
- Result parsing and display
- Auto-apply changes (with approval)

---

*Part of the Hal Stack 🦞*
*Created: 2026-03-03*
*Updated: 2026-03-04 (Endor Labs integration)*
*Author: Rook 🐦‍⬛*
