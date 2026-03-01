import type { Session, Project, ProjectContext } from "../types";

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
