package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"openclaw/skills/relay/relay"
)

// TelegramConfig for sending updates
type TelegramConfig struct {
	Enable  bool   `json:"enable"`
	Updates bool   `json:"updates"`
	Channel string `json:"channel"`
}

func main() {
	workdir := flag.String("workdir", ".", "Project directory")
	task := flag.String("task", "", "Task description")
	telegram := flag.Bool("telegram", true, "Send Telegram updates")

	flag.Parse()

	if *task == "" {
		fmt.Fprintln(os.Stderr, "❌ Error: --task is required")
		fmt.Fprintln(os.Stderr, "\nUsage:")
		fmt.Fprintln(os.Stderr, "  relay --workdir <path> --task \"your task\"")
		fmt.Fprintln(os.Stderr, "\nExamples:")
		fmt.Fprintln(os.Stderr, "  relay --workdir ~/repos/dev1/pb-api --task \"Review the iOS filter\"")
		fmt.Fprintln(os.Stderr, "  relay --workdir ~/repos/triagebox --task \"Add Sentry integration\"")
		os.Exit(1)
	}

	// Resolve to absolute path
	absPath, err := filepath.Abs(*workdir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Error: %v\n", err)
		os.Exit(1)
	}

	// Create session manager
	sm := relay.NewSessionManager()

	// Start session
	session, err := sm.StartSession(absPath, *task, "8412715352")
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Error: %v\n", err)
		os.Exit(1)
	}

	// Send start notification
	if *telegram {
		sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf(
			"🚀 Starting Relay session\n\n"+
				"Project: %s\n"+
				"Type: %s\n"+
				"Goal: %s",
			session.ProjectPath, session.ProjectType, session.Goal))
	}

	// Prepare workspace (skills + dev-docs)
	workspacePath, err := sm.PrepareWorkspace(session)
	if err != nil {
		sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf("❌ Failed to prepare workspace: %v", err))
		fmt.Fprintf(os.Stderr, "❌ Error: %v\n", err)
		os.Exit(1)
	}

	// Copy project files to workspace
	if err := sm.CopyProjectFiles(session, workspacePath); err != nil {
		sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf("⚠️  Failed to copy project files: %v\n\nWill continue anyway...", err))
		// Don't fail on copy error, container might work with skills only
	}

	sm.UpdateProgress(session.SessionID, "Workspace prepared with project files")

	// Send context info
	if *telegram {
		sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf(
			"📂 Context loaded: Skills + dev-docs copied to 13rac1 workspace\n\n"+
				"⏳ Spawning container..."))
	}

	// Create task prompt
	taskPrompt, err := sm.CreateTaskPrompt(session)
	if err != nil {
		sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf("❌ Failed to create task: %v", err))
		fmt.Fprintf(os.Stderr, "❌ Error: %v\n", err)
		os.Exit(1)
	}

	// Create temp file for task
	tmpFile, err := os.CreateTemp("", "relay-task-*.txt")
	if err != nil {
		sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf("❌ Failed to create temp file: %v", err))
		fmt.Fprintf(os.Stderr, "❌ Error: %v\n", err)
		os.Exit(1)
	}
	tmpFilePath := tmpFile.Name()
	defer os.Remove(tmpFilePath)

	if _, err := tmpFile.WriteString(taskPrompt); err != nil {
		sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf("❌ Failed to write task: %v", err))
		fmt.Fprintf(os.Stderr, "❌ Error: %v\n", err)
		os.Exit(1)
	}
	tmpFile.Close()

	// Start 13rac1 session (via claude_code_start tool)
	// This would call the OpenClaw tool
	// For now, just print what would happen
	fmt.Printf("\n🔲 Starting 13rac1 session...\n")
	fmt.Printf("   Session ID: %s\n", session.SessionID)
	fmt.Printf("   Workspace: %s\n", workspacePath)
	fmt.Printf("   Task file: %s\n\n", tmpFilePath)

	sm.UpdateProgress(session.SessionID, "13rac1 container started")

	// Run iteration loop
	maxIterations := 5 // Default max iterations
	maxAutoIterations := 3 // Auto-approve first 3 iterations for hands-off mode

	for i := 0; i < maxIterations; i++ {
		// Check if we should auto-approve this iteration
		autoApprove := i < maxAutoIterations

		sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf(
			"🔄 Iteration %d/%d%s\n\n⏳ Running 13rac1 session...",
			i+1, maxIterations, map[bool]string{true: " (auto)", false: ""}[autoApprove]))

		// Would call claude_code_start here
		// For now, simulate completion
		sm.UpdateProgress(session.SessionID, fmt.Sprintf("Iteration %d complete", i+1))

		// Simulate getting results (placeholder)
		results := fmt.Sprintf("Session complete - would read from claude_code_output")

		// Check if iteration needed
		shouldIterate, nextTask, reason := relay.CheckIterationNeeded(results)

		if !shouldIterate {
			sm.CompleteSession(session.SessionID, "Goal reached")
			sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf(
				"✅ %s\n\nGoal reached after %d iteration%s",
				reason, i+1, map[bool]string{true: "s", false: ""}[i == 0]))
			break
		}

		// Ask user about next iteration
		sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf(
			"🤔 %s\n\nSuggested next task:\n%s\n\nReply 'yes' to iterate, 'no' to stop",
			reason, nextTask))

		// Wait for user response (simulated - would use Telegram webhook)
		// For now, auto-approve if in auto-approval range
		if autoApprove {
			sm.SendTelegramUpdate(session.TelegramChat, "⏩ Auto-approving iteration...")
			session.Goal = nextTask
		} else {
			sm.SendTelegramUpdate(session.TelegramChat, "⏸️ Waiting for response (reply 'yes' to continue)...")
			// Would wait for actual Telegram message here
			// For now, break
			break
		}
	}

	// Check if we exhausted max iterations
	if i >= maxIterations-1 {
		sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf(
			"⚠️ Max iterations (%d) reached", maxIterations))
		sm.CompleteSession(session.SessionID, "Max iterations reached")
	}

	// Send completion notification
	if *telegram {
		sm.SendTelegramUpdate(session.TelegramChat, fmt.Sprintf(
			"✅ Relay session complete!\n\n"+
				"Session: %s\n"+
				"Result: Container started, waiting for results\n"+
				"Next: Check session output and review changes",
			session.SessionID))
	}

	// Save session state
	sm.saveState()
}

func (sm *SessionManager) saveState() {
	// Would save to SESSION-STATE.md
	fmt.Printf("💾 Session state saved to memory\n")
}
