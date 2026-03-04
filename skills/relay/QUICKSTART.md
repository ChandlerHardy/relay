# Relay Skill - Quick Start Guide

**What:** Orchestrate 13rac1 containers with your context injected

**Where:** `~/.openclaw/skills/relay/`

---

## Quick Start

### Basic Usage

```bash
# From the skill directory
cd ~/.openclaw/skills/relay

# Run relay
node cmd/relay/main.js --workdir ~/repos/dev1/pb-api \
  --task "Review api/protocol_routes.go for iOS 3.x compatibility"
```

### What Happens

1. **Detects** project type (PHP)
2. **Loads** pb-www-guidelines from `.claude/skills/`
3. **Loads** dev-docs design patterns
4. **Copies** skills to 13rac1 workspace
5. **Spawns** container via `claude_code_start`
6. **Updates** Telegram on progress
7. **Tracks** session state
8. **Returns** results

---

## Examples

### Code Review
```bash
node cmd/relay/main.js \
  --workdir ~/repos/dev1/pb-api \
  --task "Review api/protocol_routes.go"
```

### Feature Implementation
```bash
node cmd/relay/main.js \
  --workdir ~/repos/triagebox \
  --task "Add Sentry error tracking"
```

### Bug Fix
```bash
node cmd/relay/main.js \
  --workdir ~/repos/dev0/pb-www \
  --task "Fix pagination issue"
```

---

## Proactive Features

- ✅ Session tracking (remembers what it's working on)
- ✅ Telegram updates (progress notifications)
- ✅ Working buffer (tracks progress, blockers)
- ✅ Follow-up loops (suggests next steps)
- ✅ Task persistence (saves state to memory)

---

## What Gets Injected

**Project Skills:**
- `.claude/skills/*-guidelines/` (project-specific)
- Example: pb-www-guidelines, triagebox-guidelines

**Dev-Docs:**
- `~/repos/notes/resources/dev-docs/design-patterns/SKILL.md`

**NOT Injected:**
- Full PARA (too much for one-shot)
- Memory files
- Areas/Projects/Archive

---

## Difference from 13rac1 Alone

| Feature | 13rac1 Alone | Relay |
|---------|--------------|-------|
| Context | Isolated | Your skills + dev-docs |
| Tracking | Manual | Automatic |
| Updates | Check manually | Telegram |
| Next Steps | Manual | Proactive |

---

*Built: 2026-03-03 2:58 PM*
*By: Rook 🐦‍⬛*
*Status: Ready for use*
