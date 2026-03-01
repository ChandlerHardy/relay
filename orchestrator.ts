import { callPM } from "./ai-client.ts";
import { PM_SYSTEM_PROMPT, PLAN_TOOL, EVALUATE_TOOL, SUMMARIZE_TOOL, buildTaskPrompt } from "./prompts.ts";
import type { Assignment, Task } from "./assignments.ts";
import { randomUUID } from "crypto";

interface ProjectContext {
  claudeMd: string | null;
  skills: { name: string; description: string }[];
  config: { hooksCount: number; hooks: string[] };
}

export interface EvaluationResult {
  verdict: "pass" | "retry" | "fail";
  reasoning: string;
  adjustedPrompt?: string;
}

export async function planAssignment(
  assignment: Assignment,
  projectContext: ProjectContext,
): Promise<Task[]> {
  const contextParts: string[] = [`Goal: ${assignment.goal}`];
  if (projectContext.claudeMd) {
    contextParts.push(`CLAUDE.md:\n${projectContext.claudeMd}`);
  }
  if (projectContext.skills.length > 0) {
    contextParts.push(
      `Available skills: ${projectContext.skills.map((s) => s.name).join(", ")}`,
    );
  }

  const response = await callPM({
    system: PM_SYSTEM_PROMPT,
    messages: [{ role: "user", content: contextParts.join("\n\n") }],
    tools: [PLAN_TOOL],
  });

  // Extract tool_use block
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("PM did not return a plan");
  }

  const input = toolUse.input as { tasks: Array<{ description: string; role: Task["role"]; prompt: string; dependencies: number[] }> };

  // Convert to Task objects, mapping index-based dependencies to UUIDs
  const taskIds: string[] = [];
  const tasks: Task[] = input.tasks.map((t, _i) => {
    const id = randomUUID();
    taskIds.push(id);
    return {
      id,
      description: t.description,
      role: t.role,
      status: "pending" as const,
      dependencies: [], // filled in below
      sessionIds: [],
      evaluation: null,
      prompt: t.prompt,
      retryCount: 0,
    };
  });

  // Resolve index-based dependencies to UUIDs
  for (let i = 0; i < input.tasks.length; i++) {
    tasks[i].dependencies = input.tasks[i].dependencies
      .filter((idx) => idx >= 0 && idx < taskIds.length)
      .map((idx) => taskIds[idx]);
  }

  return tasks;
}

export async function evaluateSession(
  task: Task,
  sessionOutput: string,
  assignment: Assignment,
): Promise<EvaluationResult> {
  // Truncate output if too long (keep last 8000 chars for context)
  const truncatedOutput = sessionOutput.length > 8000
    ? "...[truncated]...\n" + sessionOutput.slice(-8000)
    : sessionOutput;

  const response = await callPM({
    system: PM_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Evaluate whether this task was completed successfully.

Task: ${task.description}
Role: ${task.role}
Original prompt: ${task.prompt}

Session output:
${truncatedOutput}

Assignment goal: ${assignment.goal}`,
      },
    ],
    tools: [EVALUATE_TOOL],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    // Default to pass if PM doesn't use the tool (shouldn't happen but safe fallback)
    return { verdict: "pass", reasoning: "PM did not evaluate (defaulted to pass)" };
  }

  const input = toolUse.input as EvaluationResult;
  return {
    verdict: input.verdict,
    reasoning: input.reasoning,
    adjustedPrompt: input.adjustedPrompt,
  };
}

export async function summarizeAssignment(
  assignment: Assignment,
): Promise<string> {
  const taskSummaries = assignment.tasks
    .map((t) => `- [${t.status}] ${t.description}${t.evaluation ? `: ${t.evaluation}` : ""}`)
    .join("\n");

  const response = await callPM({
    system: PM_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Summarize what was accomplished for this assignment.

Goal: ${assignment.goal}
Tasks:
${taskSummaries}`,
      },
    ],
    tools: [SUMMARIZE_TOOL],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return "Assignment completed.";
  }

  const input = toolUse.input as { summary: string };
  return input.summary;
}

// Re-export buildTaskPrompt for convenience
export { buildTaskPrompt } from "./prompts.ts";
