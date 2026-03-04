# Relay Skill - Iterative Enhancement

**Adding:** Iterative execution loop to Relay skill

---

## New Feature: Iterative Execution

**Problem:** 13rac1 is one-shot, but Relay should iterate until goal is reached.

**Solution:** Relay monitors results and suggests next iterations automatically.

---

## How Iteration Works

```
User Task: "Fix the iOS filter bug"
   ↓
Relay Session 1: Run 13rac1
   ↓
Check Results
   ↓
Analyze: "Found 3 issues"
   ↓
Suggest: "Iterate on fixes?"
   ↓
User: "Yes"
   ↓
Relay Session 2: Run 13rac1 with "Fix these 3 issues"
   ↓
Check Results
   ↓
Analyze: "2 issues resolved, 1 needs more work"
   ↓
Suggest: "Iterate again?"
   ↓
User: "Yes"
  
... continue until goal reached
```

---

## Implementation

### Iteration Detection

```go
// IterationState tracks iteration progress
type IterationState struct {
    CurrentIteration int           `json:"currentIteration"`
    MaxIterations    int              `json:"maxIterations"`
    GoalStatus      string          `json:"goalStatus"`     // "not-started", "in-progress", "complete"
    IssuesFound      []string         `json:"issuesFound"`
    IssuesResolved   []string         `json:"issuesResolved"`
}

// CheckIterationNeeded analyzes results to determine if iteration is needed
func CheckIterationNeeded(results string) (bool, string, string) {
    // Parse results for:
    // - "Found X issues"
    // - "TODO: Fix ..."
    // - "ERROR: ..."

    // Return: shouldIterate, nextTask, reason
}
```

### Iteration Loop

```go
// RunIterationLoop executes the full iterative process
func (sm *SessionManager) RunIterationLoop(session *SessionState, maxIterations int) error {
    iterationState := &IterationState{
        CurrentIteration: 0,
        MaxIterations:    maxIterations,
        GoalStatus:      "not-started",
    }

    for iterationState.CurrentIteration < iterationState.MaxIterations {
        // Prepare workspace
        workspacePath, err := sm.PrepareWorkspace(session)
        if err != nil {
            return err
        }

        // Create task prompt (may include iteration context)
        taskPrompt := sm.createIterationTaskPrompt(session, iterationState)

        // Spawn 13rac1 container
        // (via claude_code_start tool)
        sessionID := spawnContainer(taskPrompt, workspacePath)

        // Wait for completion
        waitForCompletion(sessionID)

        // Read results
        results := readResults(sessionID)

        // Update progress
        sm.UpdateProgress(session.SessionID,
            fmt.Sprintf("Iteration %d complete", iterationState.CurrentIteration))

        // Check if iteration needed
        shouldIterate, nextTask, reason := CheckIterationNeeded(results)

        if !shouldIterate {
            sm.CompleteSession(session.SessionID, "Goal reached")
            sm.SendTelegramUpdate(session.TelegramChat,
                fmt.Sprintf("✅ Goal reached after %d iterations", iterationState.CurrentIteration))
            return nil
        }

        // Ask user about iteration
        sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf(
            "🔄 Iteration %d complete\n\n%s\n\nSuggested next task:\n%s\n\nContinue? (reply 'yes' to iterate)",
            iterationState.CurrentIteration, reason, nextTask))

        // Wait for user response (or timeout)
        userResponse := waitForUserResponse(session.TelegramChat, 300) // 5 min timeout

        if userResponse != "yes" && userResponse != "y" {
            sm.SendTelegramUpdate(session.TelegramChat, "🛑 User stopped iteration")
            sm.CompleteSession(session.SessionID, "Stopped by user")
            return nil
        }

        // Update session goal for next iteration
        session.Goal = nextTask
        iterationState.CurrentIteration++
        iterationState.IssuesFound = append(iterationState.IssuesFound, reason)
    }

    return fmt.Errorf("max iterations (%d) reached without completing goal", maxIterations)
}
```

### User Response Handler

```go
// waitForUserResponse waits for Telegram response
func waitForUserResponse(chatID string, timeoutSeconds int) string {
    // This would integrate with Telegram message tool
    // For now, return "yes" to auto-iterate (hands-off mode)
    // or wait for actual user message

    // For now, assume auto-iterate for hands-off operation
    return "yes"
}
```

---

## Example Usage

### Manual Iteration

```
User: "Use relay to review iOS filter"

Relay (Iteration 1):
- Runs 13rac1 session
- Results: "Found 2 issues: unused import, no test case"
- Telegram: "🔄 Iteration 1 complete - Found 2 issues. Suggested: Fix unused import, add test case. Continue?"
- User: "yes"

Relay (Iteration 2):
- Runs 13rac1 session with "Fix unused import, add test case"
- Results: "All issues resolved"
- Telegram: "✅ Goal reached after 2 iterations"
```

### Auto-Iteration (Hands-Off)

```
User: "Use relay to review iOS filter --auto"

Relay (Iterations 1-3):
- Iteration 1: Runs review → "Found 3 issues"
- Iteration 2: Fixes issues → "1 issue remains"
- Iteration 3: Final fix → "All good"
- Telegram: "✅ Goal reached after 3 iterations"
```

---

## Configuration

### Max Iterations

```go
const (
    DefaultMaxIterations = 5
    AutoApproveIterations = 3  // For hands-off mode
)
```

### Auto-Mode Flag

```bash
relay --workdir ~/repos/dev1/pb-api \
  --task "Review the iOS filter" \
  --auto-iterations 3  # Auto-approve up to 3 iterations
```

---

## Benefits

✅ **Automatic improvement** - Iterates until goal reached
✅ **Hands-off operation** - Auto-approve N iterations
✅ **Telegram updates** - Progress notifications
✅ **Smart detection** - Analyzes results for issues
✅ **Session tracking** - Remembers iteration state
✅ **Goal-oriented** - Works until complete

---

## Status

✅ **Design complete** - Ready to implement

**Next:** Add to Relay skill when ready

---

*Enhancement proposed: 2026-03-03 3:01 PM*
*By: Rook 🐦‍⬛*
*Status: Design ready for implementation*
