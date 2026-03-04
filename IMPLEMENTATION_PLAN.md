# Relay: 13rac1 Orchestrator with Context Injection

**Project:** Relay - AI Workflow Orchestration
**Author:** Rook 🐦‍⬛
**Date:** March 3, 2026
**Status:** Implementation Ready

---

## Vision

**Relay orchestrates 13rac1/Claude Code containers with injected context** from your local skills, PARA knowledge base, and project guidelines.

**Problem Solved:**
- 13rac1 containers are isolated — missing your expertise
- Code reviews miss project-specific patterns
- Fixes don't follow established conventions
- Repeated back-and-forth to correct issues

**Solution:**
Relay reads your context and injects it into the container before the task begins.

---

## Architecture

```
User Request → Relay
                   ↓
    ┌──────────────────────────────────┐
    │ 1. Detect Project Type          │
    │    (PHP? Go? Python?)            │
    └──────────────────────────────────┘
                   ↓
    ┌──────────────────────────────────┐
    │ 2. Load Project Guidelines       │
    │    (pb-www-guidelines, etc.)     │
    └──────────────────────────────────┘
                   ↓
    ┌──────────────────────────────────┐
    │ 3. Load PARA Context            │
    │    (patterns, resources, etc.)   │
    └──────────────────────────────────┘
                   ↓
    ┌──────────────────────────────────┐
    │ 4. Inject into 13rac1 Container │
    │    (as prompt context)           │
    └──────────────────────────────────┘
                   ↓
    ┌──────────────────────────────────┐
    │ 5. Container Completes Work     │
    │    (with your context!)          │
    └──────────────────────────────────┘
                   ↓
    ┌──────────────────────────────────┐
    │ 6. Relay Reads Results          │
    └──────────────────────────────────┘
                   ↓
    ┌──────────────────────────────────┐
    │ 7. Show to User for Approval    │
    └──────────────────────────────────┘
                   ↓
    ┌──────────────────────────────────┐
    │ 8. Apply Changes if Approved    │
    └──────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Context Detection

**File:** `relay/detect_project_type.go`

```go
package relay

import (
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
    // Check for PHP project
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
    _, err := os.Stat(filepath.Join(path, ".claude", "skills"))
    return err == nil
}
```

---

### Phase 2: Context Loading

**File:** `relay/context_loader.go`

```go
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
        
        if strings.HasSuffix(info.Name(), "-guidelines.md") || 
           strings.HasSuffix(info.Name(), "-guidelines/SKILL.md") {
            content, err := os.ReadFile(path)
            if err != nil {
                return err
            }
            guidelines = append(guidelines, string(content))
        }
        
        return nil
    })
    
    if err != nil {
        return "", fmt.Errorf("error walking skills directory: %w", err)
    }
    
    if len(guidelines) == 0 {
        return "", fmt.Errorf("no project guidelines found")
    }
    
    return strings.Join(guidelines, "\n\n---\n\n"), nil
}

// LoadPARAContext loads relevant PARA knowledge
func (cl *ContextLoader) LoadPARAContext() (string, error) {
    // Check for PARA structure
    paraDir := os.Getenv("HOME") + "/repos/notes"
    
    // Load patterns and resources
    var context []string
    
    // Load patterns if they exist
    patternsFile := filepath.Join(paraDir, "areas", "recurring-patterns.md")
    if content, err := os.ReadFile(patternsFile); err == nil {
        context = append(context, fmt.Sprintf("# Recurring Patterns\n\n%s", string(content)))
    }
    
    // Load design patterns if applicable
    if cl.projectType == TypeGo || cl.projectType == TypeNode {
        patternsFile := filepath.Join(paraDir, "resources", "dev-docs", "design-patterns", "SKILL.md")
        if content, err := os.ReadFile(patternsFile); err == nil {
            context = append(context, fmt.Sprintf("# Design Patterns\n\n%s", string(content)))
        }
    }
    
    return strings.Join(context, "\n\n---\n\n"), nil
}

// LoadFullContext loads all available context
func (cl *ContextLoader) LoadFullContext() (string, error) {
    var parts []string
    
    // Load project skills
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
        return "", fmt.Errorf("no context found")
    }
    
    return strings.Join(parts, "\n\n---\n\n"), nil
}
```

---

### Phase 3: 13rac1 Integration

**File:** `relay/orchestrator.go`

```go
package relay

import (
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
    "syscall"
)

// Orchestrator manages 13rac1 containers with context injection
type Orchestrator struct {
    projectPath string
    contextLoader *ContextLoader
}

// NewOrchestrator creates a new orchestrator
func NewOrchestrator(projectPath string) *Orchestrator {
    return &Orchestrator{
        projectPath: projectPath,
        contextLoader: NewContextLoader(projectPath),
    }
}

// RunTask executes a task in a 13rac1 container with injected context
func (o *Orchestrator) RunTask(task string, options ...string) error {
    // Load context
    context, err := o.contextLoader.LoadFullContext()
    if err != nil {
        return fmt.Errorf("failed to load context: %w", err)
    }
    
    // Build prompt with context
    fullPrompt := fmt.Sprintf(`# Context and Guidelines

You are working on a project with specific patterns and guidelines. Follow them carefully.

%s

# Task

%s`, context, task)
    
    // Create temp file for prompt (to avoid shell escaping issues)
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
    args := []string{"--dangerously-skip-permissions", "--output-format", "stream-json"}
    args = append(args, options...)
    args = append(args, tmpFile.Name())
    
    cmd := exec.Command("claude", args...)
    cmd.Dir = o.projectPath
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    cmd.Stdin = os.Stdin
    
    // Set process group to handle signals
    cmd.SysProcAttr = &syscall.SysProcAttr{
        Setpgid: true,
        Setctty: true,
    }
    
    // Run in foreground (interactive)
    fmt.Printf("🚀 Running task with %d bytes of injected context...\n\n", len(context))
    
    return cmd.Run()
}

// RunTaskBackground executes a task in background (for automation)
func (o *Orchestrator) RunTaskBackground(task string, options ...string) (string, error) {
    // Load context
    context, err := o.contextLoader.LoadFullContext()
    if err != nil {
        return "", fmt.Errorf("failed to load context: %w", err)
    }
    
    // Build prompt with context
    fullPrompt := fmt.Sprintf(`# Context and Guidelines

%s

# Task

%s`, context, task)
    
    // Create temp file
    tmpFile, err := os.CreateTemp("", "relay-task-*.txt")
    if err != nil {
        return "", fmt.Errorf("failed to create temp file: %w", err)
    }
    
    if _, err := tmpFile.WriteString(fullPrompt); err != nil {
        tmpFile.Close()
        return "", fmt.Errorf("failed to write prompt: %w", err)
    }
    tmpFile.Close()
    
    // Build command
    args := []string{"--dangerously-skip-permissions", "--output-format", "stream-json"}
    args = append(args, options...)
    args = append(args, tmpFile.Name())
    
    cmd := exec.Command("claude", args...)
    cmd.Dir = o.projectPath
    
    // Start process
    if err := cmd.Start(); err != nil {
        return "", fmt.Errorf("failed to start: %w", err)
    }
    
    pid := cmd.Process.Pid
    tmpFile.Close()
    
    return fmt.Sprintf("Task started with PID %d", pid), nil
}
```

---

### Phase 4: CLI Interface

**File:** `relay/cmd/relay/main.go`

```go
package main

import (
    "flag"
    "fmt"
    "os"
    "path/filepath"
)

func main() {
    workdir := flag.String("workdir", ".", "Project directory")
    task := flag.String("task", "", "Task description or prompt file")
    background := flag.Bool("background", false, "Run in background")
    flag.Parse()
    
    if *task == "" {
        fmt.Fprintln(os.Stderr, "Error: --task is required")
        os.Exit(1)
    }
    
    // Resolve to absolute path
    absPath, err := filepath.Abs(*workdir)
    if err != nil {
        fmt.Fprintf(os.Stderr, "Error: %v\n", err)
        os.Exit(1)
    }
    
    // Create orchestrator
    orchestrator := NewOrchestrator(absPath)
    
    // Run task
    if *background {
        pid, err := orchestrator.RunTaskBackground(*task)
        if err != nil {
            fmt.Fprintf(os.Stderr, "Error: %v\n", err)
            os.Exit(1)
        }
        fmt.Println(pid)
    } else {
        if err := orchestrator.RunTask(*task); err != nil {
            fmt.Fprintf(os.Stderr, "Error: %v\n", err)
            os.Exit(1)
        }
    }
}
```

---

## Usage Examples

### Example 1: Code Review with Context

```bash
# Interactive review of current branch
relay --workdir ~/repos/dev1/pb-api \
  --task "Review the iOS filter implementation in api/protocol_routes.go. Follow pb-www-guidelines if available. Use 8-agent enhanced review process."

# Or use a prompt file
echo "Review the protocols changes" > /tmp/review-task.txt
relay --workdir ~/repos/dev1/pb-api --task /tmp/review-task.txt
```

### Example 2: Feature Implementation

```bash
# Implement feature with project context
relay --workdir ~/repos/triagebox \
  --task "Add Sentry integration to the Next.js frontend. Follow frontend-dev-guidelines from .claude/skills/"
```

### Example 3: Background Automation

```bash
# Run code review in background
relay --workdir ~/repos/dev1/pb-api \
  --task "Review protocol_routes.go" \
  --background
```

---

## Configuration

### Environment Variables

```bash
# Optional: Custom PARA location
export RELAY_PARA_PATH="$HOME/repos/notes"

# Optional: Default workdir
export RELAY_DEFAULT_WORKDIR="$HOME/repos"
```

### Project Skills Structure

Relay looks for skills in:
```
project/
└── .claude/
    └── skills/
        ├── project-guidelines/SKILL.md  ← Loaded automatically
        ├── backend-dev-guidelines/     ← Loaded if PHP/Go
        ├── frontend-dev-guidelines/    ← Loaded if Node/React
        └── refactoring-patterns/        ← Always loaded
```

---

## Documentation

### README

**File:** `~/repos/relay/README.md`

```markdown
# Relay - 13rac1 Orchestrator with Context Injection

**What it does:** Orchestrates Claude Code/13rac1 containers with your local skills and PARA knowledge base injected.

**Why:** Isolated containers miss your expertise. Relay gives them your context.

**Features:**
- ✅ Automatic project type detection (PHP, Go, Python, Node)
- ✅ Loads project-level guidelines (.claude/skills/)
- ✅ Loads PARA knowledge base (patterns, resources)
- ✅ Injects context into Claude Code containers
- ✅ Interactive and background modes
- ✅ Safe and isolated (still containerized)

## Installation

```bash
# Clone relay repo
git clone https://github.com/chandlerhardy/relay.git ~/repos/relay
cd ~/repos/relay

# Build
go build -o bin/relay ./cmd/relay

# Install
cp bin/relay /usr/local/bin/relay
```

## Usage

### Quick Start

```bash
# Review code with project context
relay --workdir ~/repos/dev1/pb-api \
  --task "Review api/protocol_routes.go for iOS 3.x compatibility"

# Implement feature with guidelines
relay --workdir ~/repos/triagebox \
  --task "Add PostHog analytics following frontend-dev-guidelines"
```

### Background Mode

```bash
# Run in background for automation
relay --workdir ~/repos/dev1/pb-api \
  --task "Review changes" \
  --background
```

### With Prompt File

```bash
# Create detailed prompt
cat > /tmp/task.txt << 'EOF'
Review the iOS filter implementation:
1. Follow pb-www-guidelines
2. Use 8-agent enhanced review
3. Check for CRUD parity
EOF

# Run with prompt file
relay --workdir ~/repos/dev1/pb-api --task /tmp/task.txt
```

## Context Loading

Relay automatically loads:

1. **Project Skills** (if `.claude/skills/` exists)
   - `*-guidelines/SKILL.md` files
   - Backend/frontend guidelines
   - Refactoring patterns

2. **PARA Knowledge Base** (if `~/repos/notes` exists)
   - Recurring patterns
   - Design patterns
   - Resources and areas

3. **Project Type Detection**
   - PHP: `phplib/` exists
   - Go: `go.mod` exists
   - Python: `pyproject.toml` exists
   - Node: `package.json` exists

## Examples

### Code Review

```bash
relay --workdir ~/repos/dev1/pb-api \
  --task "Review the iOS filter changes. Follow pb-www-guidelines if available."
```

### Bug Fix

```bash
relay --workdir ~/repos/dev1/pb-api \
  --task "Fix the unused import error in protocol_routes.go"
```

### Feature Implementation

```bash
relay --workdir ~/repos/triagebox \
  --task "Implement Sentry error tracking in Next.js frontend"
```

## Architecture

```
User Request → Relay
    ↓
Detect Project Type
    ↓
Load Project Skills (.claude/skills/)
    ↓
Load PARA Context (~/repos/notes/)
    ↓
Inject into Claude Code
    ↓
Container Completes Work
    ↓
User Reviews Results
    ↓
Apply Changes if Approved
```

## Why Relay?

**Problem:** 13rac1 containers are isolated — missing your expertise

**Solution:** Relay injects your context (skills, PARA, patterns)

**Result:** Better code reviews, better fixes, faster iteration

---

*Part of the Hal Stack 🦞*
```

---

## Implementation Decision

I need your input on one thing before I start coding:

**Question:** For the initial implementation, should I:

A) **Build a minimal CLI tool** (relay command) that orchestrates Claude Code with context injection?

B) **Create an OpenClaw skill** that does the same thing (could be called `relay` skill)?

C) **Both** — CLI tool for terminal use, skill for chat interface?

**My recommendation:** Start with **Option A (CLI tool)** — it's simpler to test and iterate, and you can use it directly in your terminal. We can wrap it in a skill later.

**Which would you prefer?** 🦞
