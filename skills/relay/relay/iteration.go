package relay

import (
	"fmt"
	"regexp"
	"strings"
)

// IterationState tracks iteration progress
type IterationState struct {
	CurrentIteration int      `json:"currentIteration"`
	MaxIterations    int      `json:"maxIterations"`
	GoalStatus       string   `json:"goalStatus"`
	IssuesFound      []string `json:"issuesFound"`
	IssuesResolved   []string `json:"issuesResolved"`
}

// CheckIterationNeeded analyzes results to determine if iteration is needed
func CheckIterationNeeded(results string) (bool, string, string) {
	issues := []string{}

	// Look for issue indicators
	if strings.Contains(results, "❌") {
		issues = append(issues, "Errors found")
	}

	if regexp.MustCompile(`(?i)issue #?\d+`).MatchString(results) {
		issues = append(issues, "Issues flagged")
	}

	if regexp.MustCompile(`(?i)TODO|FIXME`).MatchString(results) {
		issues = append(issues, "TODOs found")
	}

	if strings.Contains(results, "⚠️") {
		issues = append(issues, "Warnings flagged")
	}

	if len(issues) == 0 {
		// Check for completion indicators
		if strings.Contains(results, "✅") || strings.Contains(results, "complete") {
			return false, "", "Goal reached"
		}
	}

	if len(issues) > 0 {
		// Generate next task
		nextTask := fmt.Sprintf("Address these issues:\n\n%s\n\nFix all flagged issues and ensure tests pass.",
			strings.Join(issues, "\n"))

		return true, nextTask, fmt.Sprintf("Found %d issues: %s", len(issues), strings.Join(issues, ", "))
	}

	// If no issues found and no completion indicators, ask user
	return true, "", "Unclear if goal reached - review results and decide next steps"
}

// ShouldAutoApprove checks if iteration should be auto-approved
func ShouldAutoApprove(iteration int, maxAutoIterations int) bool {
	return iteration < maxAutoIterations
}

// GenerateIterationTaskPrompt creates task prompt for an iteration
func GenerateIterationTaskPrompt(session *SessionState, iterationState *IterationState) string {
	context := ""

	if iterationState.CurrentIteration > 0 {
		context = fmt.Sprintf(`# Iteration Context

This is iteration %d of potentially %d.

Previous iterations found: %s
Resolved issues: %s

`,
			iterationState.CurrentIteration,
			iterationState.MaxIterations,
			strings.Join(iterationState.IssuesFound, "; "),
			strings.Join(iterationState.IssuesResolved, "; "))
	}

	return context + fmt.Sprintf(`# Task (Iteration %d)

Original goal: %s

%s

Please continue working on this task, addressing any feedback from previous iterations.
`,
		iterationState.CurrentIteration+1,
		session.Goal,
		context)
}
