package relay

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

const (
	endorMCPName = "endor-cli-tools"
	endorMCPCommand = "npx"
	endorMCPArgs = "-y endorctl ai-tools mcp-server"
)

// EndorLabsManager handles Endor Labs MCP integration
type EndorLabsManager struct {
	configPath string
}

// NewEndorLabsManager creates a new Endor Labs manager
func NewEndorLabsManager() *EndorLabsManager {
	homeDir, _ := os.UserHomeDir()
	return &EndorLabsManager{
		configPath: filepath.Join(homeDir, ".claude", "mcp.json"),
	}
}

// IsInstalled checks if Endor Labs MCP is configured
func (e *EndorLabsManager) IsInstalled() bool {
	// Read MCP config
	data, err := os.ReadFile(e.configPath)
	if err != nil {
		return false
	}

	var config map[string]interface{}
	if err := json.Unmarshal(data, &config); err != nil {
		return false
	}

	servers, ok := config["mcpServers"].(map[string]interface{})
	if !ok {
		return false
	}

	_, exists := servers[endorMCPName]
	return exists
}

// Install adds Endor Labs MCP to Claude Code configuration
func (e *EndorLabsManager) Install() error {
	fmt.Println("🔒 Installing Endor Labs MCP security scanner...")

	// Run the claude mcp add command
	cmd := exec.Command("claude", "mcp", "add", endorMCPName, "--", endorMCPCommand, endorMCPArgs)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to install Endor Labs MCP: %w", err)
	}

	fmt.Println("✅ Endor Labs MCP installed successfully")
	return nil
}

// EnsureInstalled checks if Endor Labs MCP is installed and installs it if not
func (e *EndorLabsManager) EnsureInstalled() error {
	if e.IsInstalled() {
		fmt.Println("✅ Endor Labs MCP already installed")
		return nil
	}

	fmt.Println("⚠️  Endor Labs MCP not found, installing...")
	return e.Install()
}

// GetSecurityInstructions returns security instructions to include in prompts
func (e *EndorLabsManager) GetSecurityInstructions() string {
	if !e.IsInstalled() {
		return ""
	}

	return `
## Security Scanning

Endor Labs MCP server is available for security analysis:
- Use it to check dependencies for vulnerabilities
- Scan code for security issues before suggesting changes
- Verify no credentials or secrets are being introduced
`
}
