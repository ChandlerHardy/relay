# Relay Skill - REVISED - Coding Agent Orchestrator

**Correction:** 13rac1 is a FULL CODING AGENT (not just a reviewer)

**Date:** March 3, 2026 4:22 PM

---

## What 13rac1 Actually Does

**My misunderstanding:** I thought 13rac1 was just a "run task and show results" tool

**Reality:** 13racrac1 is a CODING AGENT that:
1. Works in your ACTUAL repo (not workspace)
2. Makes changes via git commands
3. Runs tests
4. Gets your run-down/approval
5. **Commits and pushes changes to your branch**

**This is FULL AUTONOMY with context injection**

---

## Updated Architecture

```
User Task → Relay
    ↓
Detect project + Load skills/dev-docs
    ↓
Spawn CODING AGENT (sessions_spawn, runtime=acp)
    ↓
Agent works in YOUR ACTUAL repo
    ↓
Agent runs tests
    ↓
Gets your run-down/approval
    ↓
Agent commits + pushes to branch
    ↓
You review in VS Code
```

---

## What Relay Should Be

**Orchestration layer** for coding agents

**Features:**
- Detect project type
- Load minimal context (skills + dev-docs)
- Spawn coding agent in YOUR repo
- Send Telegram updates
- Track session state
- Monitor progress

**NOT:**
- A "review" skill (that's 8-agent code-review skill)
- A "CLI tool" (that's the old Relay)

---

## Implementation Changes

### Use sessions_spawn (NOT coding-agent skill)

**Before (WRONG):**
```javascript
coding-agent skill via sessions_spawn
```

**After (CORRECT):**
```javascript
sessions_spawn({
  runtime: "acp",
  task: "Review iOS filter",
  cwd: ~/repos/dev1/pb-api,
  attachAs: ~/repos/dev1/pb-api
})
```

### Auto-Commit Settings

**File:** `~/.openclaw/openclaw.json`

Add config:
```json
{
  "features": {
    "sessions_spawn": {
      "autocommit": true,
      "attachAsRoot": false,
      "defaultModel": "claude-sonnet-4.5"
    }
  }
}
```

---

## What This Enables

**Before (My Old Understanding):**
```
User → Relay (13rac1 wrapper)
  ↓
Read files in 13rac1 workspace (empty)
  ↓
13rac1 shows results
  ↓
User manually copies to repo
  ↓<arg_value>User commits manually
```

**After (CORRECT):**
```
User → Relay
  ↓
Spawn coding agent IN YOUR repo
  ↓
Agent works on code with your context
  ↓
Agent commits changes to branch
  ↓
You review in VS Code
  ↓<arg_value>Agent pushes to GitLab
```

---

## Benefits

✅ **Fully autonomous** — Agent does everything from start to push
✅ **Context-rich** - Your skills + dev-docs injected
✅ **Safe** - Still gets your review before pushing
✅ **Faster** - No manual copy step needed
✅ **Iterative** - Agent can iterate until goal reached
✅ **Telegram updates** - Progress notifications

---

## Status

**Current:** Need to update:
1. Relay skill → Use sessions_spawn (runtime="acp")
2. Add autocommit config to openclaw.json
3. Test with dev1 iOS filter

---

*Revised: 2026-03-03 4:22 PM*
*By: Rook 🐦‍⬛*
*Status: Needs update to use sessions_spawn, NOT 13rac1 tool*
