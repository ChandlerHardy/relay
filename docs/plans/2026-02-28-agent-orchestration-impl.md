# P3: Agent Orchestration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Relay's frontend to React and build an event-driven orchestration engine that takes high-level goals, breaks them into tasks via Anthropic API calls, and executes them as Claude Code sessions.

**Architecture:** React + Vite frontend with Zustand store and WebSocket integration. Backend gains a new `orchestrator.ts` module that makes Anthropic API calls at assignment lifecycle events (plan, evaluate, summarize). Existing session infrastructure stays intact — assignments are a layer on top.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, Zustand, TanStack Router, @anthropic-ai/sdk, Node.js v25+

**Design doc:** `docs/plans/2026-02-28-agent-orchestration-design.md`

**Reference patterns (from `~/.claude/dev-docs/design-patterns/`):**
- `zai-anthropic-proxy.md` — z.ai is GLM (not real Claude) with Anthropic-compatible API. Use direct Anthropic API for PM orchestration quality; z.ai as optional cost-saving fallback.
- `ai-model-fallback.md` — Fallback chain pattern from triagebox/chronicle. Apply simplified version: Anthropic Sonnet → z.ai GLM-4.7 → error.
- `project-structure.md` — Flat monorepo pattern. Relay keeps single-server backend but gains structured `src/` frontend.

---

## Phase 1: React Migration (Tasks 1-4)

Migrate the existing vanilla JS frontend to React without changing any backend code or adding new features. The app should look and behave identically after migration.

### Task 1: Scaffold React + Vite Project

**Files:**
- Create: `src/main.tsx` (React entry point)
- Create: `src/App.tsx` (root component)
- Create: `src/vite-env.d.ts`
- Create: `vite.config.ts`
- Create: `tsconfig.json` (frontend — rename existing to `tsconfig.server.json` if conflicts)
- Create: `index.html` (Vite root — replaces `public/index.html` as entry)
- Modify: `package.json` (add React deps, Vite scripts)
- Modify: `server.ts` (serve Vite dev output or built `dist/` in production)

**Step 1: Install dependencies**

```bash
npm install react react-dom zustand @tanstack/react-router @anthropic-ai/sdk
npm install -D @vitejs/plugin-react vite vitest @testing-library/react @testing-library/jest-dom @types/react @types/react-dom jsdom
```

**Step 2: Create Vite config**

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: { outDir: "dist" },
  server: {
    proxy: {
      "/api": "http://localhost:3847",
      "/ws": { target: "ws://localhost:3847", ws: true },
    },
  },
});
```

**Step 3: Create React entry point**

`index.html` (Vite root):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relay</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return <div>Relay — migration in progress</div>;
}
```

**Step 4: Update package.json scripts**

```json
{
  "scripts": {
    "start": "node server.ts",
    "dev": "node --watch server.ts",
    "dev:ui": "vite",
    "build": "vite build",
    "test": "vitest"
  }
}
```

**Step 5: Verify scaffolding works**

```bash
npm run dev:ui
# Visit http://localhost:5173 — should show "Relay — migration in progress"
# API proxy should forward /api/* to :3847
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold React + Vite frontend"
```

---

### Task 2: Shared Types + Zustand Store

**Files:**
- Create: `src/types.ts` (shared types for sessions, assignments)
- Create: `src/store.ts` (Zustand store — sessions, WebSocket, UI state)
- Create: `src/lib/ws.ts` (WebSocket connection manager)
- Create: `src/lib/api.ts` (fetch wrapper for REST endpoints)

**Step 1: Define types**

`src/types.ts` — Port existing implicit types to explicit TypeScript:
```ts
export interface ProjectContext {
  claudeMd: string | null;
  skills: SkillInfo[];
  config: ConfigSummary;
}

export interface SkillInfo {
  name: string;
  description: string;
}

export interface ConfigSummary {
  hooksCount: number;
  hooks: string[];
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
  assignmentId?: string;
  taskId?: string;
  role?: "research" | "implement" | "review";
}

export interface Project {
  name: string;
  path: string;
}
```

**Step 2: Create API client**

`src/lib/api.ts`:
```ts
export async function fetchSessions(): Promise<Session[]> { ... }
export async function fetchSessionOutput(id: string): Promise<string> { ... }
export async function createSession(projectDir: string, prompt: string, context: ProjectContext | null): Promise<Session> { ... }
export async function killSession(id: string): Promise<void> { ... }
export async function fetchProjects(): Promise<Project[]> { ... }
export async function fetchProjectContext(name: string): Promise<ProjectContext> { ... }
```

**Step 3: Create WebSocket manager**

`src/lib/ws.ts`:
```ts
export function connectWebSocket(handlers: {
  onOutput: (sessionId: string, data: string) => void;
  onStatus: (sessionId: string, status: string, exitCode: number | null) => void;
}): WebSocket { ... }
```

**Step 4: Create Zustand store**

`src/store.ts`:
```ts
import { create } from "zustand";

interface RelayStore {
  sessions: Session[];
  activeSessionId: string | null;
  outputBuffers: Record<string, string>;
  projects: Project[];
  // actions
  loadSessions: () => Promise<void>;
  selectSession: (id: string) => void;
  addOutput: (sessionId: string, data: string) => void;
  updateSessionStatus: (sessionId: string, status: string, exitCode: number | null) => void;
  // ... etc
}
```

**Step 5: Verify store works**

Write a quick Vitest test:
```bash
npx vitest run src/store.test.ts
```

**Step 6: Commit**

```bash
git add src/types.ts src/store.ts src/lib/
git commit -m "feat: add shared types, Zustand store, API client, WebSocket manager"
```

---

### Task 3: Migrate UI Components

**Files:**
- Create: `src/styles/global.css` (port from `public/style.css`)
- Create: `src/components/SessionList.tsx`
- Create: `src/components/SessionView.tsx`
- Create: `src/components/NewSessionDialog.tsx`
- Create: `src/components/ContextPanel.tsx` (reusable for dialog + session view)
- Create: `src/components/EmptyState.tsx`
- Modify: `src/App.tsx` (compose all components)

**Step 1: Port CSS**

Copy `public/style.css` → `src/styles/global.css`. Remove any vanilla JS-specific selectors. Add CSS variable definitions at `:root`.

**Step 2: Build components**

Port the rendering logic from `public/app.js` into React components. Each function in app.js maps to a component:
- `renderList()` → `<SessionList />`
- `renderSession()` → `<SessionView />`
- `newDialog` logic → `<NewSessionDialog />`
- `renderDialogContext()` / `renderSessionContext()` → `<ContextPanel />` (shared, props-driven)
- empty state → `<EmptyState />`

All components read from Zustand store via `useStore()` hooks.

**Step 3: Wire up App.tsx**

```tsx
export default function App() {
  const { loadSessions } = useStore();
  useEffect(() => { loadSessions(); }, []);
  useWebSocket(); // custom hook that connects WS and dispatches to store

  return (
    <div id="app">
      <aside id="sidebar">
        <header>...</header>
        <SessionList />
      </aside>
      <main>
        <SessionView />
        <EmptyState />
      </main>
      <NewSessionDialog />
    </div>
  );
}
```

**Step 4: Visual verification**

```bash
npm run dev       # start backend on :3847
npm run dev:ui    # start Vite on :5173
# Compare side-by-side with old UI (old UI still at :3847 serving public/)
# All features should work: session list, create, stream, kill, context panels
```

**Step 5: Commit**

```bash
git add src/components/ src/styles/ src/App.tsx
git commit -m "feat: migrate all UI components to React"
```

---

### Task 4: Clean Up Old Frontend + Server Static Serving

**Files:**
- Delete: `public/app.js`
- Delete: `public/style.css`
- Delete: `public/index.html`
- Modify: `server.ts` (serve `dist/` instead of `public/`, or remove static serving entirely if using Vite proxy in dev)

**Step 1: Update server.ts static file serving**

Replace the `PUBLIC_DIR` static serving with `dist/` for production builds. In dev mode, Vite proxy handles everything — the Node.js server only needs to serve API + WebSocket.

```ts
const DIST_DIR = join(import.meta.dirname, "dist");
// Static files section now serves from dist/ instead of public/
```

**Step 2: Build and verify production mode**

```bash
npm run build           # Vite builds to dist/
npm run start           # Node.js serves from dist/
# Visit http://localhost:3847 — app should work fully
```

**Step 3: Delete old frontend files**

```bash
rm public/app.js public/style.css public/index.html
rmdir public  # if empty
```

**Step 4: Verify both dev and production modes**

- Dev: `npm run dev` (backend) + `npm run dev:ui` (Vite) — works via proxy
- Prod: `npm run build && npm run start` — works from dist/

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove vanilla JS frontend, serve React build from dist/"
```

---

## Phase 2: Backend Orchestration (Tasks 5-8)

### Task 5: Assignment Types + Persistence

**Files:**
- Create: `assignments.ts` (Assignment interfaces + load/save)
- Modify: `server.ts:17-27` (import assignment types, add Session extensions)
- Modify: `src/types.ts` (add Assignment/Task/Decision types for frontend)

**Step 1: Create assignment types and persistence**

`assignments.ts`:
```ts
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";

const DATA_DIR = join(homedir(), ".relay");
const ASSIGNMENTS_FILE = join(DATA_DIR, "assignments.json");

export interface Decision {
  id: string;
  question: string;
  options: string[];
  context: string;
  status: "pending" | "resolved";
  resolution: string | null;
  resolvedBy: "user" | "pm" | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Task {
  id: string;
  description: string;
  role: "research" | "implement" | "review";
  status: "pending" | "active" | "completed" | "failed" | "retrying";
  dependencies: string[];
  sessionIds: string[];
  evaluation: string | null;
  prompt: string | null;  // PM-generated prompt for Claude Code
  retryCount: number;
}

export interface Assignment {
  id: string;
  goal: string;
  projectDir: string;
  status: "planning" | "active" | "completed" | "failed";
  autonomyLevel: "autonomous" | "available";
  tasks: Task[];
  decisions: Decision[];
  createdAt: string;
  completedAt: string | null;
  summary: string | null;
}

const assignments = new Map<string, Assignment>();

export async function saveAssignments(): Promise<void> { ... }
export async function loadAssignments(): Promise<void> { ... }
export function getAssignment(id: string): Assignment | undefined { ... }
export function getAllAssignments(): Assignment[] { ... }
export function createAssignment(goal: string, projectDir: string, autonomyLevel: "autonomous" | "available"): Assignment { ... }
export function getEligibleTasks(assignment: Assignment): Task[] {
  // Returns tasks whose dependencies are all completed and status is pending
}
```

**Step 2: Extend Session interface**

Add `assignmentId`, `taskId`, `role` to Session in `server.ts`. Update `serializeSession`, `saveSessions`, `loadSessions` for backward compatibility (use `?? undefined`).

**Step 3: Add frontend types**

Add Assignment, Task, Decision types to `src/types.ts` (mirror the backend types, minus internal fields).

**Step 4: Verify persistence**

```bash
# Start server, create assignment manually via node REPL or curl
# Restart server, verify assignment loads from ~/.relay/assignments.json
```

**Step 5: Commit**

```bash
git add assignments.ts server.ts src/types.ts
git commit -m "feat: add assignment types, persistence, session extensions"
```

---

### Task 6: Anthropic SDK + Orchestrator Core

**Files:**
- Create: `orchestrator.ts` (PM API calls — plan, evaluate, summarize)
- Create: `prompts.ts` (PM system prompt + role-specific prompt templates)
- Create: `ai-client.ts` (Anthropic SDK wrapper with provider fallback chain)

**Step 1: Create AI client with fallback chain**

`ai-client.ts` — Follows the fallback chain pattern from `~/.claude/dev-docs/design-patterns/ai-model-fallback.md` and `zai-anthropic-proxy.md`:

```ts
import Anthropic from "@anthropic-ai/sdk";

// Provider chain: Real Anthropic (quality) → z.ai GLM (cost fallback)
// IMPORTANT: z.ai serves GLM models, not real Claude. Anthropic is preferred
// for PM orchestration where reasoning quality matters.
interface AIProvider {
  name: string;
  client: Anthropic;
  model: string;
}

function buildProviderChain(): AIProvider[] {
  const providers: AIProvider[] = [];

  // Primary: Direct Anthropic API (real Claude)
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      name: "anthropic",
      client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
      model: "claude-sonnet-4-6",
    });
  }

  // Fallback: z.ai proxy (GLM models with Anthropic-compatible API)
  if (process.env.ZAI_API_KEY) {
    providers.push({
      name: "zai",
      client: new Anthropic({
        apiKey: process.env.ZAI_API_KEY,
        baseURL: "https://api.z.ai/api/anthropic/v1",
      }),
      model: "claude-sonnet-4-5-20250929",  // z.ai maps this to GLM-4.7
    });
  }

  if (providers.length === 0) {
    throw new Error("No AI provider configured. Set ANTHROPIC_API_KEY or ZAI_API_KEY.");
  }

  return providers;
}

export async function callPM(params: {
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxTokens?: number;
}): Promise<Anthropic.Message> {
  const providers = buildProviderChain();

  for (const provider of providers) {
    try {
      return await provider.client.messages.create({
        model: provider.model,
        max_tokens: params.maxTokens ?? 4096,
        system: params.system,
        messages: params.messages,
        ...(params.tools && { tools: params.tools }),
      });
    } catch (err) {
      console.error(`[AI] ${provider.name} failed:`, err);
      // Fall through to next provider
    }
  }

  throw new Error("All AI providers failed");
}
```

**Step 2: Create PM prompts**

`prompts.ts`:
```ts
export const PM_SYSTEM_PROMPT = `You are a Project Manager agent for Relay...`;

export const PLAN_TOOL: Anthropic.Tool = {
  name: "create_plan",
  description: "Break a goal into implementation tasks",
  input_schema: { ... },
};

export const EVALUATE_TOOL: Anthropic.Tool = { ... };
export const SUMMARIZE_TOOL: Anthropic.Tool = { ... };

// Role-specific prompt templates that instruct sessions to use
// Claude Code's internal skill ecosystem (TDD, ralph-local, etc.)
export function buildResearchPrompt(task: Task): string { ... }
export function buildImplementPrompt(task: Task): string { ... }
export function buildReviewPrompt(task: Task): string { ... }
```

**Step 3: Create orchestrator**

`orchestrator.ts`:
```ts
import { callPM } from "./ai-client.ts";
import { PM_SYSTEM_PROMPT, PLAN_TOOL, EVALUATE_TOOL, SUMMARIZE_TOOL } from "./prompts.ts";

export async function planAssignment(assignment: Assignment, projectContext: ProjectContext): Promise<Task[]> {
  const response = await callPM({
    system: PM_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Goal: ${assignment.goal}\n\nProject context: ...` }],
    tools: [PLAN_TOOL],
  });
  // Extract tool_use block, parse tasks
}

export async function evaluateSession(task: Task, sessionOutput: string, assignment: Assignment): Promise<EvaluationResult> { ... }

export async function summarizeAssignment(assignment: Assignment): Promise<string> { ... }
```

**Step 4: Verify with dry run**

```bash
ANTHROPIC_API_KEY=... node -e "
  import { planAssignment } from './orchestrator.ts';
  const result = await planAssignment(
    { goal: 'Add a health check endpoint that returns server uptime', projectDir: '/tmp/test' },
    { claudeMd: null, skills: [], config: { hooksCount: 0, hooks: [] } }
  );
  console.log(JSON.stringify(result, null, 2));
"
```

**Step 5: Commit**

```bash
git add ai-client.ts orchestrator.ts prompts.ts
git commit -m "feat: add orchestration engine with AI fallback chain (Anthropic → z.ai)"
```

---

### Task 7: Assignment API Endpoints

**Files:**
- Modify: `server.ts` (add 6 new endpoints)

**Step 1: Add assignment endpoints to server.ts**

```
POST   /api/assignments              → create assignment, trigger planAssignment()
GET    /api/assignments              → list all assignments
GET    /api/assignments/:id          → get assignment detail (tasks, decisions)
DELETE /api/assignments/:id          → cancel assignment, kill running sessions
PATCH  /api/assignments/:id/autonomy → toggle autonomy level
POST   /api/assignments/:id/decisions/:did → resolve a pending decision
```

The POST handler is the key one — it:
1. Creates the assignment with status `planning`
2. Fetches project context (reuse existing context endpoint logic)
3. Calls `planAssignment()` to get task breakdown
4. Stores tasks on the assignment
5. Marks assignment as `active`
6. Calls a new `advanceAssignment()` function that spawns sessions for eligible tasks
7. Broadcasts assignment status via WebSocket

**Step 2: Create `advanceAssignment()` helper**

This is the heart of the event loop:
```ts
async function advanceAssignment(assignmentId: string) {
  const assignment = getAssignment(assignmentId);
  if (!assignment || assignment.status !== "active") return;

  const eligible = getEligibleTasks(assignment);
  for (const task of eligible) {
    task.status = "active";
    const session = createSession(assignment.projectDir, task.prompt!, assignment context);
    session.assignmentId = assignmentId;
    session.taskId = task.id;
    session.role = task.role;
    task.sessionIds.push(session.id);
  }

  await saveAssignments();
  broadcastAssignmentUpdate(assignment);
}
```

**Step 3: Verify with curl**

```bash
# Create assignment
curl -X POST http://localhost:3847/api/assignments \
  -H "Content-Type: application/json" \
  -d '{"goal":"Add a health check endpoint","projectDir":"/Users/.../repos/test","autonomyLevel":"autonomous"}'

# List assignments
curl http://localhost:3847/api/assignments

# Get detail
curl http://localhost:3847/api/assignments/<id>
```

**Step 4: Commit**

```bash
git add server.ts
git commit -m "feat: add assignment API endpoints with orchestration loop"
```

---

### Task 8: Session Completion → Orchestrator Hook

**Files:**
- Modify: `server.ts` (in `ptyProc.onExit` handler, add orchestrator evaluation)

**Step 1: Hook session completion into orchestrator**

In the existing `ptyProc.onExit` handler in `createSession()`, after updating status and broadcasting:

```ts
ptyProc.onExit(async ({ exitCode }) => {
  session.status = exitCode === 0 ? "completed" : "failed";
  session.exitCode = exitCode;
  session.ptyProcess = null;
  broadcast({ type: "status", sessionId: id, status: session.status, exitCode });
  await saveSessions();

  // NEW: If this session belongs to an assignment, evaluate it
  if (session.assignmentId && session.taskId) {
    await handleSessionCompletion(session);
  }
});
```

**Step 2: Implement `handleSessionCompletion()`**

```ts
async function handleSessionCompletion(session: Session) {
  const assignment = getAssignment(session.assignmentId!);
  if (!assignment) return;

  const task = assignment.tasks.find(t => t.id === session.taskId);
  if (!task) return;

  const output = session.output.join("");
  const result = await evaluateSession(task, output, assignment);

  if (result.verdict === "pass") {
    task.status = "completed";
    task.evaluation = result.reasoning;
  } else if (result.verdict === "retry" && task.retryCount < 2) {
    task.status = "retrying";
    task.retryCount++;
    // Spawn new session with adjusted prompt
    const retryPrompt = result.adjustedPrompt || task.prompt!;
    const newSession = createSession(assignment.projectDir, retryPrompt, ...);
    newSession.assignmentId = assignment.id;
    newSession.taskId = task.id;
    task.sessionIds.push(newSession.id);
  } else {
    task.status = "failed";
    task.evaluation = result.reasoning;
    // If autonomy is "available" and there's a decision, queue it
    if (result.decision && assignment.autonomyLevel === "available") {
      assignment.decisions.push({ ...result.decision, status: "pending", ... });
    }
  }

  // Check if all tasks complete
  const allDone = assignment.tasks.every(t => t.status === "completed");
  const anyFailed = assignment.tasks.some(t => t.status === "failed");

  if (allDone) {
    const summary = await summarizeAssignment(assignment);
    assignment.summary = summary;
    assignment.status = "completed";
    assignment.completedAt = new Date().toISOString();
  } else if (!anyFailed) {
    await advanceAssignment(assignment.id);
  } else {
    // Some tasks failed — check if blocked or can continue
    // Failed tasks with no dependents don't block other tasks
  }

  await saveAssignments();
  broadcastAssignmentUpdate(assignment);
}
```

**Step 3: End-to-end test**

```bash
# Start server with ANTHROPIC_API_KEY set
# Create assignment targeting a simple test project
# Watch sessions spawn, complete, and next tasks start automatically
# Verify assignment reaches "completed" status
```

**Step 4: Commit**

```bash
git add server.ts
git commit -m "feat: wire session completion to orchestrator evaluation loop"
```

---

## Phase 3: Frontend — Assignment UI (Tasks 9-11)

### Task 9: Assignment Store + API Integration

**Files:**
- Modify: `src/store.ts` (add assignment state + actions)
- Modify: `src/lib/api.ts` (add assignment API functions)
- Modify: `src/lib/ws.ts` (handle assignment WebSocket events)

**Step 1: Extend API client**

```ts
export async function fetchAssignments(): Promise<Assignment[]> { ... }
export async function createAssignment(goal: string, projectDir: string, autonomyLevel: string): Promise<Assignment> { ... }
export async function cancelAssignment(id: string): Promise<void> { ... }
export async function toggleAutonomy(id: string, level: string): Promise<void> { ... }
export async function resolveDecision(assignmentId: string, decisionId: string, resolution: string): Promise<void> { ... }
```

**Step 2: Extend Zustand store**

Add to store:
```ts
assignments: Assignment[];
activeAssignmentId: string | null;
loadAssignments: () => Promise<void>;
selectAssignment: (id: string) => void;
updateAssignment: (assignment: Assignment) => void;
```

**Step 3: Extend WebSocket handler**

Handle new message types: `assignment_update`, `assignment_decision`, `assignment_complete`.

**Step 4: Commit**

```bash
git add src/store.ts src/lib/api.ts src/lib/ws.ts
git commit -m "feat: add assignment state management and API integration"
```

---

### Task 10: Assignment List + Creation Dialog

**Files:**
- Create: `src/components/AssignmentList.tsx`
- Create: `src/components/NewAssignmentDialog.tsx`
- Modify: `src/App.tsx` (add assignment section to sidebar)

**Step 1: Build AssignmentList component**

Shows assignments with: goal (truncated), status badge, task progress (3/7), time ago. Click to select. Visually distinct from session list (different section header).

**Step 2: Build NewAssignmentDialog**

Simpler than session dialog: goal textarea + project dropdown + autonomy toggle (switch/radio). No prompt field — the PM generates prompts. Submit → POST /api/assignments.

**Step 3: Wire into App.tsx**

Add assignment list section to sidebar (above sessions). Add "New Assignment" button alongside existing "+" button.

**Step 4: Visual verification**

```bash
# Create an assignment via the UI
# Verify it appears in the assignment list
# Verify sessions spawn and appear in session list with assignment badge
```

**Step 5: Commit**

```bash
git add src/components/AssignmentList.tsx src/components/NewAssignmentDialog.tsx src/App.tsx
git commit -m "feat: add assignment list and creation dialog"
```

---

### Task 11: Assignment Detail View

**Files:**
- Create: `src/components/AssignmentView.tsx`
- Create: `src/components/TaskList.tsx`
- Create: `src/components/DecisionQueue.tsx`
- Modify: `src/App.tsx` (show AssignmentView when assignment selected)
- Modify: `src/styles/global.css` (assignment-specific styles)

**Step 1: Build TaskList component**

Shows tasks with: description, role badge, status indicator, dependency info. Expandable rows showing linked session(s) and PM evaluation text. Tasks with dependencies show which tasks they're waiting on.

**Step 2: Build DecisionQueue component**

Shows pending decisions prominently. Each decision: question, options as buttons, context text. Resolving a decision → POST to API → PM continues.

**Step 3: Build AssignmentView**

Composes TaskList + DecisionQueue. Shows: goal, status badge, autonomy toggle (clickable), task progress summary, completion summary (when done).

**Step 4: Wire into App.tsx**

When an assignment is selected, show AssignmentView in main area (instead of SessionView). When a session is selected, show SessionView as before. The two views are mutually exclusive — selecting one deselects the other.

**Step 5: Add assignment-specific CSS**

Task list styles, decision queue styles, autonomy toggle, role badges (research=blue, implement=green, review=purple).

**Step 6: End-to-end verification**

```bash
# Create assignment, watch tasks appear
# Click assignment in sidebar → see detail view
# Watch task statuses update in real-time as sessions complete
# Resolve a decision if one appears
# Verify completion summary appears when all tasks done
```

**Step 7: Commit**

```bash
git add src/components/AssignmentView.tsx src/components/TaskList.tsx src/components/DecisionQueue.tsx src/App.tsx src/styles/global.css
git commit -m "feat: add assignment detail view with task list and decision queue"
```

---

## Phase 4: Polish + Dev Docs (Task 12)

### Task 12: WebSocket Events + Session Badges + Dev Docs

**Files:**
- Modify: `server.ts` (add assignment broadcast helper)
- Modify: `src/components/SessionList.tsx` (add assignment badges)
- Modify: `~/.claude/dev-docs/relay/v1/context.md`
- Modify: `~/.claude/dev-docs/relay/v1/tasks.md`

**Step 1: Add `broadcastAssignmentUpdate()` to server**

```ts
function broadcastAssignmentUpdate(assignment: Assignment) {
  broadcast({
    type: "assignment_update",
    assignment: serializeAssignment(assignment),
  });
}
```

**Step 2: Add assignment badges to SessionList**

Sessions that belong to an assignment show a small badge/tag with the assignment goal (truncated) and task role.

**Step 3: Update dev docs**

- `context.md`: Add new files (orchestrator.ts, prompts.ts, assignments.ts), new API endpoints, React frontend info
- `tasks.md`: Mark P3 items complete, update v0.3.0 section

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete P3 agent orchestration with assignment badges and updated docs"
```

---

## Environment Setup Notes

**AI provider env vars (at least one required):**
```bash
# Primary: Direct Anthropic API (real Claude — preferred for PM quality)
export ANTHROPIC_API_KEY="sk-ant-..."

# Fallback: z.ai proxy (GLM models, cheaper but lower quality)
# See ~/.claude/dev-docs/design-patterns/zai-anthropic-proxy.md
export ZAI_API_KEY="your-zai-key"
```

**Provider chain behavior:**
- If both set: tries Anthropic first, falls back to z.ai on error
- If only `ANTHROPIC_API_KEY`: uses direct Anthropic (recommended)
- If only `ZAI_API_KEY`: uses z.ai GLM models (adequate for simple tasks)
- If neither: server starts but assignment creation will fail with error

**Dev workflow (two terminals):**
```bash
# Terminal 1: Backend
ANTHROPIC_API_KEY=... npm run dev

# Terminal 2: Frontend (Vite dev server with proxy)
npm run dev:ui
```

**Production:**
```bash
npm run build
ANTHROPIC_API_KEY=... npm run start
# Serves React build from dist/ + API on :3847
```
