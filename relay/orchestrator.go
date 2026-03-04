package relay

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
)

// Orchestrator manages 13rac1/Claude Code containers with context injection
type Orchestrator struct {
	projectPath  string
	contextLoader *ContextLoader
	endorLabs    *EndorLabsManager
}

// NewOrchestrator creates a new orchestrator
func NewOrchestrator(projectPath string) *Orchestrator {
	return &Orchestrator{
		projectPath:  projectPath,
		contextLoader: NewContextLoader(projectPath),
		endorLabs:    NewEndorLabsManager(),
	}
}

// RunTask executes a task in Claude Code with injected context
func (o *Orchestrator) RunTask(task string, promptFile string, options ...string) error {
	// Ensure Endor Labs MCP is installed
	if err := o.endorLabs.EnsureInstalled(); err != nil {
		fmt.Printf("⚠️  Warning: Could not install Endor Labs MCP: %v\n", err)
	}

	// Load context
	context, err := o.contextLoader.LoadFullContext()
	if err != nil {
		return fmt.Errorf("failed to load context: %w", err)
	}

	// Add security instructions if Endor Labs is available
	securityInstructions := o.endorLabs.GetSecurityInstructions()

	// Read task from file or use string directly
	var taskContent string
	if promptFile != "" {
		content, err := os.ReadFile(promptFile)
		if err != nil {
			return fmt.Errorf("failed to read prompt file: %w", err)
		}
		taskContent = string(content)
	} else {
		taskContent = task
	}

	// Build full prompt with context and security
	fullPrompt := fmt.Sprintf(`%s

%s

# Task

%s
`, context, securityInstructions, taskContent)

	// Create temp file for prompt (avoids shell escaping issues)
	tmpFile, err := os.CreateTemp("", "relay-task-*.txt")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(fullPrompt); err != nil {
		return fmt.Errorf("failed to write prompt: %w", err)
	}
	tmpFile.Close()

	// Build command
	args := []string{
		"--dangerously-skip-permissions",
		"--output-format", "stream-json",
	}
	args = append(args, options...)
	args = append(args, tmpFile.Name())

	cmd := exec.Command("claude", args...)
	cmd.Dir = o.projectPath
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	// Set process group to handle signals properly
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
		Setctty: true,
	}

	// Show context info
	fmt.Printf("🚀 Running Relay with %d bytes of injected context...\n", len(context))
	fmt.Printf("📂 Project: %s\n", o.projectPath)
	fmt.Printf("🔧 Project Type: %s\n", o.contextLoader.projectType)

	if HasProjectSkills(o.projectPath) {
		fmt.Printf("✅ Project skills loaded from .claude/skills/\n")
	}

	if o.endorLabs.IsInstalled() {
		fmt.Printf("🔒 Endor Labs security scanning enabled\n")
	}

	// Run in foreground (interactive)
	fmt.Println("\n---\n")

	return cmd.Run()
}
