package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	workdir := flag.String("workdir", ".", "Project directory")
	task := flag.String("task", "", "Task description (or use @filename)")
	background := flag.Bool("background", false, "Run in background (not implemented yet)")
	flag.Parse()

	if *task == "" {
		fmt.Fprintln(os.Stderr, "❌ Error: --task is required")
		fmt.Fprintln(os.Stderr, "\nUsage:")
		fmt.Fprintln(os.Stderr, "  relay --workdir <path> --task \"your task here\"")
		fmt.Fprintln(os.Stderr, "  relay --workdir <path> --task @prompt.txt")
		os.Exit(1)
	}

	// Resolve to absolute path
	absPath, err := filepath.Abs(*workdir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Error: %v\n", err)
		os.Exit(1)
	}

	// Check if directory exists
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "❌ Error: directory does not exist: %s\n", absPath)
		os.Exit(1)
	}

	// Create orchestrator
	orchestrator := NewOrchestrator(absPath)

	// Check if task is a file (@filename)
	var promptFile string
	var taskContent string
	if (*task)[0] == '@' {
		promptFile = (*task)[1:]
		taskContent = "" // Will read from file
	} else {
		taskContent = *task
	}

	// Run task
	if err := orchestrator.RunTask(taskContent, promptFile); err != nil {
		fmt.Fprintf(os.Stderr, "\n❌ Error: %v\n", err)
		os.Exit(1)
	}
}
