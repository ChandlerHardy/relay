# Claude Code Context Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface Claude Code config, skills, and per-project CLAUDE.md in Relay's UI — both in the new-session dialog and in the session view.

**Architecture:** Single new API endpoint `/api/projects/:name/context` returns CLAUDE.md content, parsed skills list, and config summary. Frontend fetches on project select (dialog) and stores context snapshot on session creation (session view). Collapsible panels in both locations.

**Tech Stack:** Node.js (native TS), vanilla JS frontend, existing ws/node-pty stack.

---

### Task 1: Backend — Context Endpoint

**Files:**
- Modify: `server.ts:1-8` (add `stat` import)
- Modify: `server.ts:9-13` (add SKILLS_DIR, SETTINGS_FILE constants)
- Modify: `server.ts:174-266` (add context endpoint before static file handler)

**Step 1: Add imports and constants**

In `server.ts`, update the `fs/promises` import and add constants after line 13:

```typescript
import { readFile, readdir, writeFile, mkdir, stat } from "fs/promises";
```

Add after `SESSIONS_FILE`:

```typescript
const SKILLS_DIR = join(homedir(), ".claude", "skills");
const SETTINGS_FILE = join(homedir(), ".claude", "settings.json");
```

**Step 2: Add skill parsing helper**

Add after `stripAnsi` function (after line 98):

```typescript
interface SkillInfo {
  name: string;
  description: string;
}

async function parseSkills(): Promise<SkillInfo[]> {
  try {
    const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
    const skills: SkillInfo[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      let description = "";
      try {
        const files = await readdir(join(SKILLS_DIR, name));
        const mdFile = files.find((f) => f.endsWith(".md"));
        if (mdFile) {
          const content = await readFile(join(SKILLS_DIR, name, mdFile), "utf-8");
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (fmMatch) {
            const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
            if (descMatch) description = descMatch[1].trim();
          }
        }
      } catch {}
      skills.push({ name, description });
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

interface ConfigSummary {
  hooksCount: number;
  hooks: string[];
}

async function parseConfig(): Promise<ConfigSummary> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    const settings = JSON.parse(raw);
    const hooks = settings.hooks ? Object.keys(settings.hooks) : [];
    return { hooksCount: hooks.length, hooks };
  } catch {
    return { hooksCount: 0, hooks: [] };
  }
}

let cachedSkills: SkillInfo[] | null = null;
let cachedConfig: ConfigSummary | null = null;
```

**Step 3: Add the context API endpoint**

In the `createServer` handler, add this block after the `/api/projects` handler (after line 192) and before the `/api/sessions` GET handler:

```typescript
  // API: project context (CLAUDE.md, skills, config)
  const contextMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/context$/);
  if (contextMatch && req.method === "GET") {
    const projectName = decodeURIComponent(contextMatch[1]);
    const projectPath = join(REPOS_DIR, projectName);

    let claudeMd: string | null = null;
    try {
      claudeMd = await readFile(join(projectPath, "CLAUDE.md"), "utf-8");
    } catch {}

    if (!cachedSkills) cachedSkills = await parseSkills();
    if (!cachedConfig) cachedConfig = await parseConfig();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      claudeMd,
      skills: cachedSkills,
      config: cachedConfig,
    }));
    return;
  }
```

**Step 4: Restart dev server and test**

Run: `curl -s http://localhost:3847/api/projects/relay/context | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d),null,2)))"`

Expected: JSON with `claudeMd` (null or string), `skills` array with 12 entries, `config` with hooks.

**Step 5: Commit**

```bash
git add server.ts
git commit -m "feat: add /api/projects/:name/context endpoint for Claude Code config, skills, CLAUDE.md"
```

---

### Task 2: Frontend — Context in New-Session Dialog

**Files:**
- Modify: `public/index.html:37-55` (add context panel to dialog)
- Modify: `public/app.js:111-155` (fetch context on project select, store for submit)
- Modify: `public/style.css` (add context panel styles)

**Step 1: Add context panel HTML to dialog**

In `public/index.html`, add after the Prompt label closing `</label>` (after line 48) and before `<div class="dialog-actions">`:

```html
      <div id="dialog-context" class="context-panel" hidden>
        <button type="button" class="context-toggle" id="dialog-context-toggle">Project Context</button>
        <div class="context-body" id="dialog-context-body" hidden>
          <div class="context-section" id="dialog-claude-md-section" hidden>
            <h4>CLAUDE.md</h4>
            <pre class="context-pre" id="dialog-claude-md"></pre>
          </div>
          <div class="context-section" id="dialog-skills-section">
            <h4>Skills</h4>
            <ul class="context-skills" id="dialog-skills"></ul>
          </div>
          <div class="context-section" id="dialog-config-section">
            <h4>Config</h4>
            <p class="dim" id="dialog-config"></p>
          </div>
        </div>
      </div>
```

**Step 2: Add context fetching to app.js**

In `public/app.js`, add a `currentContext` variable after `let outputBuffers = {}` (line 16):

```javascript
let currentContext = null;
```

Add a `fetchContext` function after `loadProjects()` (after line 124):

```javascript
// Fetch project context on directory select
const inputDir = document.getElementById("input-dir");
inputDir.onchange = async () => {
  const path = inputDir.value;
  if (!path) return;
  const name = path.split("/").pop();
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(name)}/context`);
    currentContext = await res.json();
    renderDialogContext(currentContext);
  } catch {
    currentContext = null;
    document.getElementById("dialog-context").hidden = true;
  }
};

function renderDialogContext(ctx) {
  const panel = document.getElementById("dialog-context");
  const body = document.getElementById("dialog-context-body");
  const toggle = document.getElementById("dialog-context-toggle");

  panel.hidden = false;

  // CLAUDE.md
  const mdSection = document.getElementById("dialog-claude-md-section");
  const mdPre = document.getElementById("dialog-claude-md");
  if (ctx.claudeMd) {
    mdSection.hidden = false;
    mdPre.textContent = ctx.claudeMd;
  } else {
    mdSection.hidden = true;
  }

  // Skills
  const skillsList = document.getElementById("dialog-skills");
  skillsList.innerHTML = "";
  for (const s of ctx.skills) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${escapeHtml(s.name)}</strong>`;
    if (s.description) {
      li.innerHTML += ` <span class="dim">${escapeHtml(s.description.slice(0, 100))}${s.description.length > 100 ? "..." : ""}</span>`;
    }
    skillsList.appendChild(li);
  }

  // Config
  const configP = document.getElementById("dialog-config");
  if (ctx.config.hooksCount > 0) {
    configP.textContent = `${ctx.config.hooksCount} hooks: ${ctx.config.hooks.join(", ")}`;
  } else {
    configP.textContent = "No hooks configured";
  }

  // Toggle
  toggle.onclick = () => {
    body.hidden = !body.hidden;
    toggle.textContent = body.hidden ? "Project Context" : "Project Context (collapse)";
  };
}
```

**Step 3: Reset context when dialog closes**

In the existing `cancelBtn.onclick` handler (line 128), also reset context:

```javascript
cancelBtn.onclick = () => {
  newDialog.close();
  currentContext = null;
  document.getElementById("dialog-context").hidden = true;
  document.getElementById("dialog-context-body").hidden = true;
};
```

**Step 4: Test in browser**

Open `http://localhost:3847`, click "+", select a project from the dropdown.
Expected: "Project Context" toggle appears below prompt. Click it to expand and see CLAUDE.md, skills, config.

**Step 5: Commit**

```bash
git add public/index.html public/app.js
git commit -m "feat: show project context (CLAUDE.md, skills, config) in new-session dialog"
```

---

### Task 3: Backend — Store Context on Session

**Files:**
- Modify: `server.ts` (add context field to Session and PersistedSession interfaces, accept in POST)

**Step 1: Add context to interfaces**

Add `context` field to both `Session` (line 15-24) and `PersistedSession` (line 29-37):

```typescript
interface ProjectContext {
  claudeMd: string | null;
  skills: SkillInfo[];
  config: ConfigSummary;
}
```

Add to `Session` interface:
```typescript
  context: ProjectContext | null;
```

Add to `PersistedSession` interface:
```typescript
  context: ProjectContext | null;
```

**Step 2: Update saveSessions to include context**

In `saveSessions()`, add `context: s.context` to the mapped object.

**Step 3: Update loadSessions to restore context**

In `loadSessions()`, the spread already covers it since context is a plain data field.

**Step 4: Update createSession to accept context**

Change `createSession` signature to:
```typescript
function createSession(projectDir: string, prompt: string, context: ProjectContext | null): Session {
```

Set `context` in the session object initialization:
```typescript
    context,
```

**Step 5: Update serializeSession to include context**

Add to the returned object in `serializeSession`:
```typescript
    context: s.context,
```

**Step 6: Update POST handler to pass context**

In the POST `/api/sessions` handler, parse context from the body and pass it:

```typescript
    const parsed = JSON.parse(body) as {
      projectDir?: string;
      prompt?: string;
      context?: ProjectContext | null;
    };
    // ...
    const session = createSession(parsed.projectDir, parsed.prompt, parsed.context ?? null);
```

**Step 7: Update frontend to send context on submit**

In `public/app.js`, update the `newForm.onsubmit` body to include context:

```javascript
    body: JSON.stringify({ projectDir, prompt, context: currentContext }),
```

**Step 8: Test round-trip**

Create a session, reload the page. Session should still have context data.

**Step 9: Commit**

```bash
git add server.ts public/app.js
git commit -m "feat: persist project context on session creation"
```

---

### Task 4: Frontend — Context Panel in Session View

**Files:**
- Modify: `public/index.html` (add context bar to session view)
- Modify: `public/app.js` (render context in session view)
- Modify: `public/style.css` (all context panel styles)

**Step 1: Add context bar HTML to session view**

In `public/index.html`, add after `<div id="session-prompt"></div>` (after line 31) and before `<pre id="session-output">`:

```html
        <div id="session-context" class="context-panel" hidden>
          <button class="context-toggle" id="session-context-toggle"></button>
          <div class="context-body" id="session-context-body" hidden>
            <div class="context-section" id="session-claude-md-section" hidden>
              <h4>CLAUDE.md</h4>
              <pre class="context-pre" id="session-claude-md"></pre>
            </div>
            <div class="context-section" id="session-skills-section">
              <h4>Skills</h4>
              <ul class="context-skills" id="session-skills"></ul>
            </div>
            <div class="context-section" id="session-config-section">
              <h4>Config</h4>
              <p class="dim" id="session-config"></p>
            </div>
          </div>
        </div>
```

**Step 2: Add renderSessionContext to app.js**

Add after the `renderDialogContext` function:

```javascript
function renderSessionContext(ctx) {
  const panel = document.getElementById("session-context");
  const body = document.getElementById("session-context-body");
  const toggle = document.getElementById("session-context-toggle");

  if (!ctx) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;

  // Summary line
  const parts = [];
  if (ctx.claudeMd) parts.push("CLAUDE.md");
  parts.push(`${ctx.skills.length} skills`);
  if (ctx.config.hooksCount > 0) parts.push(`${ctx.config.hooksCount} hooks`);
  toggle.textContent = parts.join(" · ");

  // CLAUDE.md
  const mdSection = document.getElementById("session-claude-md-section");
  const mdPre = document.getElementById("session-claude-md");
  if (ctx.claudeMd) {
    mdSection.hidden = false;
    mdPre.textContent = ctx.claudeMd;
  } else {
    mdSection.hidden = true;
  }

  // Skills
  const skillsList = document.getElementById("session-skills");
  skillsList.innerHTML = "";
  for (const s of ctx.skills) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${escapeHtml(s.name)}</strong>`;
    if (s.description) {
      li.innerHTML += ` <span class="dim">${escapeHtml(s.description.slice(0, 100))}${s.description.length > 100 ? "..." : ""}</span>`;
    }
    skillsList.appendChild(li);
  }

  // Config
  const configP = document.getElementById("session-config");
  if (ctx.config.hooksCount > 0) {
    configP.textContent = `${ctx.config.hooksCount} hooks: ${ctx.config.hooks.join(", ")}`;
  } else {
    configP.textContent = "No hooks configured";
  }

  // Toggle expand/collapse
  toggle.onclick = () => {
    body.hidden = !body.hidden;
  };
}
```

**Step 3: Call renderSessionContext from renderSession**

In `renderSession()`, add after `killBtn.hidden = s.status !== "running";` (line 108):

```javascript
  renderSessionContext(s.context);
```

**Step 4: Add CSS for context panels**

Append to `public/style.css`:

```css
/* Context panels */
.context-panel {
  border-bottom: 1px solid var(--border);
}

.context-panel[hidden] {
  display: none !important;
}

.context-toggle {
  width: 100%;
  text-align: left;
  padding: 8px 20px;
  background: var(--bg2);
  border: none;
  border-radius: 0;
  color: var(--dim);
  font-size: 12px;
  cursor: pointer;
}

.context-toggle:hover {
  background: var(--bg3);
  color: var(--text);
}

.context-body {
  padding: 12px 20px;
  background: var(--bg);
  max-height: 300px;
  overflow-y: auto;
}

.context-body[hidden] {
  display: none !important;
}

.context-section {
  margin-bottom: 12px;
}

.context-section:last-child {
  margin-bottom: 0;
}

.context-section[hidden] {
  display: none !important;
}

.context-section h4 {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--dim);
  margin-bottom: 6px;
}

.context-pre {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--text);
  max-height: 150px;
  overflow-y: auto;
  padding: 8px;
  background: var(--bg2);
  border-radius: 4px;
}

.context-skills {
  list-style: none;
  font-size: 12px;
}

.context-skills li {
  padding: 2px 0;
}

.context-skills li strong {
  color: var(--accent);
  font-weight: 500;
}

/* Dialog context panel */
#dialog-context {
  margin-bottom: 4px;
}

#dialog-context .context-toggle {
  padding: 8px 0;
  background: none;
}

#dialog-context .context-body {
  padding: 8px 0;
  background: none;
  max-height: 200px;
}

#dialog-context .context-pre {
  max-height: 100px;
}
```

**Step 5: Test end-to-end in browser**

1. Open `http://localhost:3847`, click "+", select a project — context panel appears in dialog
2. Launch a session — session view shows context bar with summary
3. Click the context bar — expands to show CLAUDE.md, skills, config

**Step 6: Commit**

```bash
git add public/index.html public/app.js public/style.css
git commit -m "feat: add collapsible context panel to session view with CLAUDE.md, skills, config"
```

---

### Task 5: Update Dev Docs

**Files:**
- Modify: `~/.claude/dev-docs/relay/v1/tasks.md`
- Modify: `~/.claude/dev-docs/relay/v1/context.md`

**Step 1: Mark tasks complete in tasks.md**

Check off the three v0.2.0 items:
- [x] Claude Code config detection
- [x] Skills browser
- [x] CLAUDE.md display

**Step 2: Update context.md with new endpoints and files**

Add the new API endpoint and context panel details to the context doc.

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs: add design and implementation plan for Claude Code context integration"
```
