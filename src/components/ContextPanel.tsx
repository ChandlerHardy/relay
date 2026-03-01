import { useState } from "react";
import type { ProjectContext } from "../types";

interface ContextPanelProps {
  context: ProjectContext | null;
  variant: "dialog" | "session";
}

export default function ContextPanel({ context, variant }: ContextPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!context) return null;

  const summaryParts: string[] = [];
  if (variant === "session") {
    if (context.claudeMd) summaryParts.push("CLAUDE.md");
    summaryParts.push(`${context.skills.length} skills`);
    if (context.config.hooksCount > 0)
      summaryParts.push(`${context.config.hooksCount} hooks`);
  }

  const toggleLabel =
    variant === "dialog"
      ? expanded
        ? "Project Context (collapse)"
        : "Project Context"
      : summaryParts.join(" \u00b7 ");

  const panelId =
    variant === "dialog" ? "dialog-context" : "session-context";

  return (
    <div className="context-panel" id={panelId}>
      <button
        type="button"
        className="context-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        {toggleLabel}
      </button>
      {expanded && (
        <div className="context-body">
          {context.claudeMd && (
            <div className="context-section">
              <h4>CLAUDE.md</h4>
              <pre className="context-pre">{context.claudeMd}</pre>
            </div>
          )}
          <div className="context-section">
            <h4>Skills</h4>
            <ul className="context-skills">
              {context.skills.map((skill) => (
                <li key={skill.name}>
                  <strong>{skill.name}</strong>
                  {skill.description && (
                    <>
                      {" "}
                      <span className="dim">
                        {skill.description.length > 100
                          ? `${skill.description.slice(0, 100)}...`
                          : skill.description}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="context-section">
            <h4>Config</h4>
            <p className="dim">
              {context.config.hooksCount > 0
                ? `${context.config.hooksCount} hooks: ${context.config.hooks.join(", ")}`
                : "No hooks configured"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
