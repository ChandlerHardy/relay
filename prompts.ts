import type Anthropic from "@anthropic-ai/sdk";
import type { Task } from "./assignments.ts";

export const PM_SYSTEM_PROMPT = `You are a Project Manager agent for Relay, a system that orchestrates autonomous Claude Code sessions.

Your job is to break high-level goals into concrete, executable tasks for Claude Code sessions. Each task should be:
- Self-contained: A Claude Code session should be able to complete it with just the task prompt
- Appropriately scoped: Not too large (should complete in under 30 minutes), not too small (meaningful unit of work)
- Properly sequenced: Dependencies between tasks should be explicit

Task roles:
- "research": Investigate codebase, read docs, understand patterns. Output is knowledge for later tasks.
- "implement": Write code, create files, modify existing code. The core building work.
- "review": Review changes from implementation tasks. Check for bugs, style, correctness.

When creating prompts for each task, write them as if you're giving instructions to a skilled developer who has access to the full project codebase but no context about this assignment. Include specific file paths when known.`;

export const PLAN_TOOL: Anthropic.Tool = {
  name: "create_plan",
  description: "Break a goal into implementation tasks with dependencies",
  input_schema: {
    type: "object" as const,
    properties: {
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string", description: "What this task accomplishes" },
            role: { type: "string", enum: ["research", "implement", "review"] },
            prompt: { type: "string", description: "Full prompt to send to Claude Code session" },
            dependencies: {
              type: "array",
              items: { type: "number" },
              description: "Indices (0-based) of tasks this depends on",
            },
          },
          required: ["description", "role", "prompt", "dependencies"],
        },
      },
    },
    required: ["tasks"],
  },
};

export const EVALUATE_TOOL: Anthropic.Tool = {
  name: "evaluate_result",
  description: "Evaluate whether a task was completed successfully",
  input_schema: {
    type: "object" as const,
    properties: {
      verdict: { type: "string", enum: ["pass", "retry", "fail"] },
      reasoning: { type: "string", description: "Why this verdict was chosen" },
      adjustedPrompt: {
        type: "string",
        description: "If retrying, an improved prompt addressing what went wrong",
      },
    },
    required: ["verdict", "reasoning"],
  },
};

export const SUMMARIZE_TOOL: Anthropic.Tool = {
  name: "summarize_assignment",
  description: "Provide a summary of what was accomplished",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: { type: "string", description: "Concise summary of what was built/changed" },
    },
    required: ["summary"],
  },
};

export function buildTaskPrompt(task: Task): string {
  const roleInstructions: Record<Task["role"], string> = {
    research: "Your goal is to research and document findings. Do NOT make code changes. Focus on understanding the codebase, reading relevant files, and documenting what you find. Output a clear summary of your findings.",
    implement: "Your goal is to implement the described changes. Write clean, tested code. Commit your changes when done.",
    review: "Your goal is to review recent code changes. Check for bugs, logic errors, style issues, and correctness. Report your findings clearly.",
  };

  return `${roleInstructions[task.role]}\n\n${task.prompt}`;
}
