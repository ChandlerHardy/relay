import { useRef, useState } from "react";
import { useStore } from "../store";
import { createSession, fetchProjectContext } from "../lib/api";
import type { ProjectContext } from "../types";
import ContextPanel from "./ContextPanel";

export default function NewSessionDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const projects = useStore((s) => s.projects);
  const addSession = useStore((s) => s.addSession);
  const selectSession = useStore((s) => s.selectSession);

  const [projectDir, setProjectDir] = useState("");
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState<ProjectContext | null>(null);

  const openDialog = () => {
    dialogRef.current?.showModal();
  };

  const closeDialog = () => {
    dialogRef.current?.close();
    resetForm();
  };

  const resetForm = () => {
    setProjectDir("");
    setPrompt("");
    setContext(null);
    formRef.current?.reset();
  };

  const handleProjectChange = async (path: string) => {
    setProjectDir(path);
    if (!path) {
      setContext(null);
      return;
    }
    const name = path.split("/").pop();
    if (!name) return;
    try {
      const ctx = await fetchProjectContext(name);
      setContext(ctx);
    } catch {
      setContext(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDir = projectDir.trim();
    const trimmedPrompt = prompt.trim();
    if (!trimmedDir || !trimmedPrompt) return;

    const session = await createSession(trimmedDir, trimmedPrompt, context);
    if ((session as Record<string, unknown>).error) {
      alert((session as Record<string, unknown>).error);
      return;
    }

    addSession(session);
    selectSession(session.id);
    closeDialog();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      closeDialog();
    }
  };

  return (
    <>
      <button title="New Session" onClick={openDialog}>
        +
      </button>
      <dialog ref={dialogRef} id="new-dialog" onClick={handleBackdropClick}>
        <form ref={formRef} onSubmit={handleSubmit}>
          <h2>New Session</h2>
          <label>
            Project Directory
            <select
              required
              value={projectDir}
              onChange={(e) => handleProjectChange(e.target.value)}
            >
              <option value="" disabled>
                Select a project...
              </option>
              {projects.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prompt
            <textarea
              rows={6}
              placeholder="What should Claude work on?"
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <ContextPanel context={context} variant="dialog" />
          <div className="dialog-actions">
            <button type="button" onClick={closeDialog}>
              Cancel
            </button>
            <button type="submit">Launch</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
