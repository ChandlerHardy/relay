package relay

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ProjectType represents the type of project
type ProjectType string

const (
	TypePHP     ProjectType = "php"
	TypeGo      ProjectType = "go"
	TypePython  ProjectType = "python"
	TypeNode    ProjectType = "node"
	TypeUnknown ProjectType = "unknown"
)

// DetectProjectType determines the project type from directory structure
func DetectProjectType(path string) ProjectType {
	// Check for PHP project (Performance Beef pattern)
	if _, err := os.Stat(filepath.Join(path, "phplib")); err == nil {
		return TypePHP
	}

	// Check for Go project
	if _, err := os.Stat(filepath.Join(path, "go.mod")); err == nil {
		return TypeGo
	}

	// Check for Python project
	if _, err := os.Stat(filepath.Join(path, "pyproject.toml")); err == nil {
		return TypePython
	}

	// Check for Node project
	if _, err := os.Stat(filepath.Join(path, "package.json")); err == nil {
		return TypeNode
	}

	return TypeUnknown
}

// HasProjectSkills checks if project has local skills directory
func HasProjectSkills(path string) bool {
	skillsDir := filepath.Join(path, ".claude", "skills")
	info, err := os.Stat(skillsDir)
	return err == nil && info.IsDir()
}
