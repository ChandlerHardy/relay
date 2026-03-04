---
name: relay
description: Orchestrate 13rac1 containers with injected context from project skills and dev-docs. Uses proactive-agent patterns for session tracking and iteration. Sends Telegram updates on progress.
---

# Relay Skill - 13rac1 Context Injection with Proactive Patterns

**Purpose:** Wrap 13rac1 plugin with context injection and proactive behaviors (follow-up loops, working buffer, task persistence).

**What it does:**
1. Detects project type (PHP/Go/Python/Node)
2. Loads relevant project skills (*-guidelines.md)
3. Loads dev-docs (not full PARA - just design patterns)
4. Copies minimal context to 13rac1 workspace
5. Spawns container via `claude_code_start`
6. Monitors progress with `claude_code_status`
7. Reads results with `claude_code_output`
8. Cleans up with `claude_code_cancel` if needed

**Proactive Features:**
- **Session Tracking:** Remembers active 13rac1 sessions
- **Progress Updates:** Telegram notifications on milestones
- **Follow-up Loops:** Checks results and suggests next steps
- **Task Persistence:** Saves session state for recovery
- **Working Buffer:** Tracks what it's working on

---

## When to Use

✅ **USE this skill when:**
- "Use relay to review the iOS filter in dev1"
- "Orchestrate a 13rac1 session for pb-api"
- "Start a containerized coding session for TriageBox"
- Run autonomous coding tasks with your expertise

❌ **DON'T use this skill when:**
- Interactive Claude Code sessions (use VS Code directly)
- Simple one-liner fixes (use edit tool)
- Reading code (use read tool)
- Work in ~/clawd workspace (never use 13rac1 there)

---

## Proactive Patterns Used

This skill incorporates patterns from proactive-agent skill:

### Session Tracking
- Stores active 13rac1 session IDs in SESSION-STATE.md
- Tracks: project path, session goal, start time, status
- Enables: Status checks, follow-up actions

### Working Buffer
- Current task being worked on
- Progress indicators (what's done, what's next)
- Blockers or decisions needed

### Follow-up Loops
- Monitors session completion
- Suggests next steps after results
- Proposes iterations if needed

### Task Persistence
- Session state saved to memory
- Recovery if session interrupted
- Historical tracking

---

## Implementation

### Step 1: Detect Project Type

```go
// Auto-detect from directory structure
func DetectProjectType(path string) ProjectType {
    // PHP: phplib/ exists
    // Go: go.mod exists
    // Python: pyproject.toml exists
    // Node: package.json exists
}
```

### Step 2: Load Minimal Context

**What to load:**
- Project-specific guidelines (.claude/skills/*-guidelines/)
- Dev-docs design patterns (~/repos/notes/resources/dev-docs/design-patterns/SKILL.md)

**What NOT to load:**
- Full PARA (too much for one-shot sessions)
- Memory files (not relevant)
- Areas/Projects/Archive (not relevant)

### Step 3: Copy to 13rac1 Workspace

```bash
# 13rac1 workspace: ~/.openclaw/workspaces/
WORKSPACE=~/.openclaw/workspaces/relay-SESSION_ID

# Copy skills to workspace
mkdir -p $WORKSPACE/.claude/skills/
cp -r project/.claude/skills/*-guidelines/ $WORKSPACE/.claude/skills/

# Copy dev-docs
mkdir -p $WORKSPACE/dev-docs/
cp ~/repos/notes/resources/dev-docs/design-patterns/SKILL.md $WORKSPACE/dev-docs/

# Copy project files
cp -r project/ $WORKSPACE/project/
```

### Step 4: Spawn 13rac1 Container

```javascript
// Use OpenClaw tool
claude_code_start({
  prompt: taskDescription,
  cwd: workspacePath,
  session_id: sessionId,
  attachAs: workspacePath
})
```

### Step 5: Monitor Progress

```javascript
// Check session status
claude_code_status({
  job_id: sessionId,
  session_id: sessionId
})

// Send Telegram update
message({
  action: "send",
  channel: "telegram",
  target: "8412715352",
  message: "🔄 Relay session in progress..."
})
```

### Step 6: Read Results

```javascript
// Get session output
claude_code_output({
  job_id: sessionId,
  session_id: sessionId,
  offset: 0,
  limit: 10000
})

// Send Telegram update
message({
  action: "send",
  channel: "telegram",
  target: "8412715352",
  message: "✅ Relay session complete!"
})
```

### Step 7: Suggest Next Steps

Based on results, propose:
- "Should I iterate on the changes?"
- "Ready to review and apply?"
- "Need to run tests?"

---

## Examples

### Example 1: Code Review

```
User: "Use relay to review dev1/pb-api iOS filter"

Relay:
1. Detects: PHP project
2. Loads: pb-www-guidelines from .claude/skills/
3. Loads: Dev-docs design patterns
4. Copies: Skills to 13rac1 workspace
5. Spawns: Container with context
6. Monitors: Progress via Telegram
7. Reads: Results
8. Suggests: "Should I apply these changes to dev1?"
```

### Example 2: Feature Implementation

```
User: "Use relay to add Sentry to TriageBox"

Relay:
1. Detects: Node project
2. Loads: triagebox-guidelines (if exists)
3. Loads: Dev-docs patterns
4. Spawns: Container with context
5. Executes: Task with your patterns
6. Updates: Telegram on milestones
7. Returns: Code changes ready for review
```

---

## Session State Management

**File:** `SESSION-STATE.md` (in working directory)

**Track:**
- Active relay sessions
- Session goals
- Progress indicators
- Blockers

**Format:**
```markdown
## Active Relay Sessions

### Session: relay-20260303-145800
- **Project:** dev1/pb-api
- **Goal:** Review iOS filter implementation
- **Status:** In progress
- **Started:** 2026-03-03 14:58:00
- **Session ID:** <job_id from 13rac1>

## Previous Sessions

### Session: relay-20260303-143000
- **Project:** triagebox
- **Goal:** Add Sentry integration
- **Status:** Complete
- **Result:** 5 files modified
```

---

## Telegram Updates

**Progressive updates during session:**

1. **Start:** "🚀 Starting Relay session for [project]"
2. **Context:** "📂 Loaded X skills, Y patterns"
3. **Spawn:** "🔲 Container started"
4. **Progress:** "⏳ Working on [task]"
5. **Complete:** "✅ Session complete, [result]"

**Target:** 8412715352 (your Telegram)

---

## Integration with Proactive-Agent Skill

This skill incorporates proactive-agent patterns:

### Follow-Up Loop
After session completes, check:
- "Should I iterate on the changes?"
- "Are there any issues to address?"
- "Ready to apply to [project]?"

### Working Buffer
Track current state:
- What project is being worked on
- What task is being executed
- What progress has been made
- What blockers exist

### Task Persistence
Save session state to memory for:
- Recovery if session interrupted
- Historical tracking
- Learning from previous sessions

---

## Key Difference from 13rac1 Alone

| Feature | 13rac1 Alone | Relay |
|---------|--------------|-------|
| Context | Isolated workspace | Your skills + dev-docs |
| Tracking | Manual | Automatic (SESSION-STATE) |
| Updates | Check manually | Telegram notifications |
| Next Steps | Manual | Proactive suggestions |
| Pattern | One-shot | Proactive loops |

---

## Limitations

**What Relay does NOT do:**
- Iterate automatically (still one-shot)
- Make decisions without asking
- Apply changes without approval
- Run tests iteratively

**What Relay DOES:**
- Inject your expertise into 13rac1
- Track session state
- Send Telegram updates
- Suggest next steps
- Remember what it's working on

---

*Status:* ACTIVE
*Integration:* 13rac1 plugin + proactive-agent patterns
*Telegram:* Updates to 8412715352
*Created:* 2026-03-03 14:58 PM CST
