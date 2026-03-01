export interface SkillInfo {
  name: string;
  description: string;
}

export interface ConfigSummary {
  hooksCount: number;
  hooks: string[];
}

export interface ProjectContext {
  claudeMd: string | null;
  skills: SkillInfo[];
  config: ConfigSummary;
}

export interface Session {
  id: string;
  projectDir: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  outputLength: number;
  createdAt: string;
  exitCode: number | null;
  context: ProjectContext | null;
  // Future: assignment fields
  assignmentId?: string;
  taskId?: string;
  role?: "research" | "implement" | "review";
}

export interface Project {
  name: string;
  path: string;
}
