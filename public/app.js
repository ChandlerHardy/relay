const sessionList = document.getElementById("session-list");
const sessionView = document.getElementById("session-view");
const emptyState = document.getElementById("empty-state");
const sessionOutput = document.getElementById("session-output");
const sessionStatus = document.getElementById("session-status");
const sessionDir = document.getElementById("session-dir");
const sessionPrompt = document.getElementById("session-prompt");
const killBtn = document.getElementById("kill-btn");
const newBtn = document.getElementById("new-btn");
const newDialog = document.getElementById("new-dialog");
const newForm = document.getElementById("new-form");
const cancelBtn = document.getElementById("cancel-btn");

let sessions = [];
let activeId = null;
let outputBuffers = {};
let currentContext = null;

// WebSocket
const ws = new WebSocket(`ws://${location.host}/ws`);

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);

  if (msg.type === "output") {
    if (!outputBuffers[msg.sessionId]) outputBuffers[msg.sessionId] = "";
    outputBuffers[msg.sessionId] += msg.data;
    if (msg.sessionId === activeId) {
      sessionOutput.textContent = outputBuffers[msg.sessionId];
      sessionOutput.scrollTop = sessionOutput.scrollHeight;
    }
  }

  if (msg.type === "status") {
    const s = sessions.find((s) => s.id === msg.sessionId);
    if (s) {
      s.status = msg.status;
      s.exitCode = msg.exitCode;
    }
    renderList();
    if (msg.sessionId === activeId) renderSession();
  }
};

ws.onclose = () => {
  setTimeout(() => location.reload(), 2000);
};

// Load sessions
async function loadSessions() {
  const res = await fetch("/api/sessions");
  sessions = await res.json();
  for (const s of sessions) {
    if (!outputBuffers[s.id]) {
      const out = await fetch(`/api/sessions/${s.id}/output`);
      const data = await out.json();
      outputBuffers[s.id] = data.output;
    }
  }
  renderList();
}

function renderList() {
  sessionList.innerHTML = "";
  for (const s of sessions) {
    const li = document.createElement("li");
    li.className = s.id === activeId ? "active" : "";
    li.onclick = () => selectSession(s.id);

    const statusDot =
      s.status === "running"
        ? '<span class="running-indicator"></span>'
        : s.status === "completed"
          ? '<span style="color:var(--green)">&#10003;</span>'
          : '<span style="color:var(--red)">&#10007;</span>';

    li.innerHTML = `
      <span class="session-prompt-preview">${escapeHtml(s.prompt.slice(0, 80))}</span>
      <span class="session-meta">
        ${statusDot}
        <span>${s.projectDir.split("/").pop()}</span>
        <span>${timeAgo(s.createdAt)}</span>
      </span>
    `;
    sessionList.appendChild(li);
  }
}

function selectSession(id) {
  activeId = id;
  renderList();
  renderSession();
}

function renderSession() {
  const s = sessions.find((s) => s.id === activeId);
  if (!s) return;

  emptyState.hidden = true;
  sessionView.hidden = false;

  sessionStatus.textContent = s.status;
  sessionStatus.className = `status-badge ${s.status}`;
  sessionDir.textContent = s.projectDir;
  sessionPrompt.textContent = s.prompt;
  sessionOutput.textContent = outputBuffers[s.id] || "";
  sessionOutput.scrollTop = sessionOutput.scrollHeight;

  killBtn.hidden = s.status !== "running";
}

// Load projects into dropdown
async function loadProjects() {
  const res = await fetch("/api/projects");
  const projects = await res.json();
  const select = document.getElementById("input-dir");
  for (const p of projects) {
    const opt = document.createElement("option");
    opt.value = p.path;
    opt.textContent = p.name;
    select.appendChild(opt);
  }
}

loadProjects();

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

// New session
newBtn.onclick = () => newDialog.showModal();
function resetContextPanel() {
  currentContext = null;
  document.getElementById("dialog-context").hidden = true;
  document.getElementById("dialog-context-body").hidden = true;
}

cancelBtn.onclick = () => {
  newDialog.close();
  resetContextPanel();
};
newDialog.onclick = (e) => {
  if (e.target === newDialog) newDialog.close();
};

newForm.onsubmit = async (e) => {
  e.preventDefault();
  const projectDir = document.getElementById("input-dir").value.trim();
  const prompt = document.getElementById("input-prompt").value.trim();

  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectDir, prompt, context: currentContext }),
  });

  const session = await res.json();
  if (session.error) {
    alert(session.error);
    return;
  }

  sessions.push(session);
  outputBuffers[session.id] = "";
  selectSession(session.id);
  newDialog.close();
  newForm.reset();
  resetContextPanel();
};

// Kill session
killBtn.onclick = async () => {
  if (!activeId) return;
  await fetch(`/api/sessions/${activeId}`, { method: "DELETE" });
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

  // Toggle expand/collapse
  toggle.textContent = body.hidden ? "Project Context" : "Project Context (collapse)";
  toggle.onclick = () => {
    body.hidden = !body.hidden;
    toggle.textContent = body.hidden ? "Project Context" : "Project Context (collapse)";
  };
}

// Helpers
function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

loadSessions();
