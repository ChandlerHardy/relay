package relay

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ContextLoader loads project skills and PARA knowledge
type ContextLoader struct {
	projectPath string
	projectType ProjectType
}

// NewContextLoader creates a new context loader
func NewContextLoader(path string) *ContextLoader {
	return &ContextLoader{
		projectPath: path,
		projectType: DetectProjectType(path),
	}
}

// LoadProjectSkills loads project-level guidelines
func (cl *ContextLoader) LoadProjectSkills() (string, error) {
	skillsDir := filepath.Join(cl.projectPath, ".claude", "skills")

	// Find *-guidelines.md files
	var guidelines []string
	err := filepath.Walk(skillsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if info.IsDir() {
			return nil
		}

		// Check for guidelines files
		if strings.HasSuffix(info.Name(), "-guidelines.md") ||
			strings.HasSuffix(info.Name(), "-guidelines/SKILL.md") {
			content, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			guidelines = append(guidelines, fmt.Sprintf("# %s\n\n%s", info.Name(), string(content)))
		}

		return nil
	})

	if err != nil {
		return "", fmt.Errorf("error walking skills directory: %w", err)
	}

	if len(guidelines) == 0 {
		return "", fmt.Errorf("no project guidelines found in .claude/skills/")
	}

	return strings.Join(guidelines, "\n\n---\n\n"), nil
}

// LoadPARAContext loads relevant PARA knowledge
func (cl *ContextLoader) LoadPARAContext() (string, error) {
	// Check for PARA structure
	paraDir := os.Getenv("HOME") + "/repos/notes"

	// Load patterns and resources
	var context []string

	// Load recurring patterns if they exist
	patternsFile := filepath.Join(paraDir, "areas", "recurring-patterns.md")
	if content, err := os.ReadFile(patternsFile); err == nil {
		context = append(context, fmt.Sprintf("# Recurring Patterns\n\n%s", string(content)))
	}

	// Load design patterns if applicable
	if cl.projectType == TypeGo || cl.projectType == TypeNode {
		devDocsDir := filepath.Join(paraDir, "resources", "dev-docs", "design-patterns", "SKILL.md")
		if content, err := os.ReadFile(devDocsDir); err == nil {
			context = append(context, fmt.Sprintf("# Design Patterns\n\n%s", string(content)))
		}
	}

	return strings.Join(context, "\n\n---\n\n"), nil
}

// LoadFullContext loads all available context
func (cl *ContextLoader) LoadFullContext() (string, error) {
	var parts []string

	// Load project skills first (highest priority)
	projectSkills, err := cl.LoadProjectSkills()
	if err == nil {
		parts = append(parts, projectSkills)
	}

	// Load PARA context
	paraContext, err := cl.LoadPARAContext()
	if err == nil {
		parts = append(parts, paraContext)
	}

	if len(parts) == 0 {
		return "", fmt.Errorf("no context found (no project skills or PARA knowledge)")
	}

	// Add context summary
	summary := fmt.Sprintf(`# Context and Guidelines

You are working on a %s project with specific patterns and guidelines.

Follow the project guidelines below carefully. They contain established patterns, conventions, and best practices for this codebase.

`, cl.projectType)

	parts = append([]string{summary}, parts...)

	return strings.Join(parts, "\n\n---\n\n"), nil
}
