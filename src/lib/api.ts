import type { Session, Project, ProjectContext, Assignment } from "../types";

const BASE = ""; // Same origin in dev (Vite proxy), same server in prod

export async function fetchSessions(): Promise<Session[]> {
  const res = await fetch(`${BASE}/api/sessions`);
  return res.json();
}

export async function fetchSessionOutput(id: string): Promise<string> {
  const res = await fetch(`${BASE}/api/sessions/${id}/output`);
  const data = await res.json();
  return data.output;
}

export async function createSession(
  projectDir: string,
  prompt: string,
  context: ProjectContext | null,
): Promise<Session> {
  const res = await fetch(`${BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectDir, prompt, context }),
  });
  return res.json();
}

export async function killSession(id: string): Promise<void> {
  await fetch(`${BASE}/api/sessions/${id}`, { method: "DELETE" });
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${BASE}/api/projects`);
  return res.json();
}

export async function fetchProjectContext(
  name: string,
): Promise<ProjectContext> {
  const res = await fetch(
    `${BASE}/api/projects/${encodeURIComponent(name)}/context`,
  );
  return res.json();
}

// Assignment API
export async function fetchAssignments(): Promise<Assignment[]> {
  const res = await fetch(`${BASE}/api/assignments`);
  return res.json();
}

export async function fetchAssignment(id: string): Promise<Assignment> {
  const res = await fetch(`${BASE}/api/assignments/${id}`);
  return res.json();
}

export async function createAssignment(
  goal: string,
  projectDir: string,
  autonomyLevel: "autonomous" | "available",
): Promise<Assignment> {
  const res = await fetch(`${BASE}/api/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal, projectDir, autonomyLevel }),
  });
  return res.json();
}

export async function cancelAssignment(id: string): Promise<void> {
  await fetch(`${BASE}/api/assignments/${id}`, { method: "DELETE" });
}

export async function toggleAutonomy(
  id: string,
  level: "autonomous" | "available",
): Promise<Assignment> {
  const res = await fetch(`${BASE}/api/assignments/${id}/autonomy`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autonomyLevel: level }),
  });
  return res.json();
}

export async function resolveDecision(
  assignmentId: string,
  decisionId: string,
  resolution: string,
): Promise<Assignment> {
  const res = await fetch(
    `${BASE}/api/assignments/${assignmentId}/decisions/${decisionId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    },
  );
  return res.json();
}
