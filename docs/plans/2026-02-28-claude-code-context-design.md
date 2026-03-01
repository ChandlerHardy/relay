# Claude Code Context Integration — Design

## Summary

Add visibility into Claude Code's configuration, skills, and per-project CLAUDE.md within Relay's UI. Purely informational — the autonomous agent already has access to these at runtime; this surfaces them for the human operator.

## API

### `GET /api/projects/:name/context`

Single endpoint returning all context for a project directory.

```json
{
  "claudeMd": "# Project Instructions\n...",
  "skills": [
    { "name": "backend-dev-guidelines", "description": "Comprehensive backend..." }
  ],
  "config": {
    "hooksCount": 3,
    "hooks": ["PostToolUse", "Stop", "SessionStart"]
  }
}
```

- **claudeMd** — reads `<projectDir>/CLAUDE.md`, null if absent
- **skills** — reads `~/.claude/skills/*/` directories. Parses name from folder name, description from skill frontmatter if available. Global (same for all projects), cached after first request.
- **config** — summarizes `~/.claude/settings.json`. Hook types and count. Global, cached.

## UI: New-Session Dialog

On project select, fetch context and render a collapsible "Project Context" section below the prompt textarea. Collapsed by default.

Sections when expanded:
1. **CLAUDE.md** — rendered as preformatted text, truncated at ~20 lines with "show more"
2. **Skills** — list of skill names with descriptions
3. **Config** — summary line (e.g., "3 hooks: PostToolUse, Stop, SessionStart")

## UI: Session View — Context Panel

Collapsible bar between session header and output. Single-line summary when collapsed: "Context: CLAUDE.md present · 12 skills · 3 hooks"

Expands to show same three sections as the dialog.

Context data is stored on the session object at creation time so it doesn't require re-fetching.

## Data Flow

1. User selects project in dropdown -> fetch `/api/projects/:name/context` -> render in dialog
2. User launches session -> context snapshot saved with session metadata
3. User views session -> context panel reads from stored session data

## Files Changed

| File | Changes |
|------|---------|
| `server.ts` | Add context endpoint, skill directory scanning, settings parsing |
| `public/index.html` | Context sections in dialog and session view |
| `public/app.js` | Fetch on project select, collapsible panel logic, render context |
| `public/style.css` | Collapsible panel styles, context section layout |
