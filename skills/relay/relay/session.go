package relay

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// SessionState tracks active relay sessions
type SessionState struct {
	SessionID    string    `json:"sessionId"`
	ProjectPath  string    `json:"projectPath"`
	ProjectType  ProjectType `json:"projectType"`
	Goal         string    `json:"goal"`
	Status       string    `json:"status"`
	StartedAt    time.Time `json:"startedAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
	Progress     string    `json:"progress"`
	TelegramChat string    `json:"telegramChat"`
}

// SessionManager manages active relay sessions
type SessionManager struct {
	sessions map[string]*SessionState
}

// NewSessionManager creates a new session manager
func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*SessionState),
	}
}

// StartSession starts a new relay session
func (sm *SessionManager) StartSession(projectPath, goal, telegramChat string) (*SessionState, error) {
	// Detect project type
	projectType := DetectProjectType(projectPath)

	// Create session state
	session := &SessionState{
		SessionID:    fmt.Sprintf("relay-%d", time.Now().Unix()),
		ProjectPath:  projectPath,
		ProjectType:  projectType,
		Goal:         goal,
		Status:       "starting",
		StartedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		TelegramChat: telegramChat,
	}

	// Save to sessions
	sm.sessions[session.SessionID] = session

	return session, nil
}

// UpdateProgress updates session progress
func (sm *SessionManager) UpdateProgress(sessionID, progress string) error {
	session, exists := sm.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	session.Progress = progress
	session.UpdatedAt = time.Now()

	return nil
}

// CompleteSession marks session as complete
func (sm *SessionManager) CompleteSession(sessionID, result string) error {
	session, exists := sm.sessions[sessionID]
	if !exists {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	session.Status = "complete"
	session.Progress = result
	session.UpdatedAt = time.Now()

	return nil
}

// GetSession retrieves session state
func (sm *SessionManager) GetSession(sessionID string) (*SessionState, error) {
	session, exists := sm.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session not found: %sessionID")
	}

	return session, nil
}

// SendTelegramUpdate sends a Telegram message (via message tool)
func SendTelegramUpdate(chatID, message string) error {
	// This would call the message tool
	// For now, just log it
	fmt.Printf("[Telegram to %s]: %s\n", chatID, message)
	return nil
}

// PrepareWorkspace prepares the 13rac1 workspace with context
func (sm *SessionManager) PrepareWorkspace(session *SessionState) (string, error) {
	// Create workspace directory
	workspacesDir := os.Getenv("HOME") + "/.openclaw/workspaces"
	workspacePath := filepath.Join(workspacesDir, session.SessionID)

	if err := os.MkdirAll(workspacePath, 0755); err != nil {
		return "", fmt.Errorf("failed to create workspace: %w", err)
	}

	// Copy project skills
	projectSkillsDir := filepath.Join(session.ProjectPath, ".claude", "skills")
	if _, err := os.Stat(projectSkillsDir); err == nil {
		workspaceSkillsDir := filepath.Join(workspacePath, ".claude", "skills")
		if err := os.MkdirAll(workspaceSkillsDir, 0755); err == nil {
			// Copy *-guidelines files
			filepath.Walk(projectSkillsDir, func(path string, info os.FileInfo, err error) error {
				if err != nil || info.IsDir() {
					return nil
				}

				if strings.HasSuffix(info.Name(), "-guidelines.md") ||
				   strings.HasSuffix(info.Name(), "-guidelines/SKILL.md") {
					content, err := os.ReadFile(path)
					if err != nil {
						return err
					}

					destPath := filepath.Join(workspaceSkillsDir, filepath.Base(path))
					if err := os.WriteFile(destPath, content, 0644); err != nil {
						return err
					}
				}

				return nil
			})
		}
	}

	// Copy dev-docs design patterns
	devDocsPath := os.Getenv("HOME") + "/repos/notes/resources/dev-docs/design-patterns/SKILL.md"
	if _, err := os.Stat(devDocsPath); err == nil {
		content, err := os.ReadFile(devDocsPath)
		if err != nil {
			return "", fmt.Errorf("failed to read dev-docs: %w", err)
		}

		workspaceDevDocs := filepath.Join(workspacePath, "dev-docs")
		if err := os.MkdirAll(workspaceDevDocs, 0755); err == nil {
			if err := os.WriteFile(filepath.Join(workspaceDevDocs, "SKILL.md"), content, 0644); err != nil {
				return "", fmt.Errorf("failed to copy dev-docs: %w", err)
			}
		}
	}

	return workspacePath, nil
}

// CreateTaskPrompt creates the task prompt for Claude Code
func (sm *SessionManager) CreateTaskPrompt(session *SessionState) (string, error) {
	// Build task prompt with context
	return fmt.Sprintf(`# Task

%s

# Context

You are working on a %s project.

## Project Guidelines

Follow the project guidelines in .claude/skills/*-guidelines/ (if available).

## Design Patterns

Follow the design patterns in dev-docs/SKILL.md (if available).

## Goal

%s

Please complete this task following the project's established patterns and conventions.
`, session.Goal, session.ProjectType, session.Goal), nil
}
