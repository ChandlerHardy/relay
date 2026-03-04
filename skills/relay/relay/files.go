package relay

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// CopyProjectFiles copies project files to workspace
func (sm *SessionManager) CopyProjectFiles(session *SessionState, workspacePath string) error {
	// Copy entire project directory to workspace
	projectDest := filepath.Join(workspacePath, "project")

	// Create destination directory
	if err := os.MkdirAll(projectDest, 0755); err != nil {
		return fmt.Errorf("failed to create project dir: %w", err)
	}

	// Copy project files
	return filepath.Walk(session.ProjectPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip certain directories
		if info.IsDir() {
			// Skip .git, node_modules, vendor, etc.
			base := filepath.Base(path)
			switch base {
			case ".git", "node_modules", "vendor", "bin", "obj", "TestResults":
				return filepath.SkipDir
			default:
				return nil
			}
		}

		// Copy file
	relPath, err := filepath.Rel(session.ProjectPath, path)
		if err != nil {
			return err
	}

		destPath := filepath.Join(projectDest, relPath)

	// Create directory structure
	destDir := filepath.Dir(destPath)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	// Copy file
	return copyFile(path, destPath)
}

// copyFile copies a file from src to dst
func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	if err != nil {
		return err
	}

	return dstFile.Close()
}
