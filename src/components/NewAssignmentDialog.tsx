import { useRef, useState } from "react";
import { useStore } from "../store";
import { createAssignment } from "../lib/api";

export default function NewAssignmentDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const projects = useStore((s) => s.projects);
  const updateAssignment = useStore((s) => s.updateAssignment);
  const selectAssignment = useStore((s) => s.selectAssignment);

  const [goal, setGoal] = useState("");
  const [projectDir, setProjectDir] = useState("");
  const [autonomyLevel, setAutonomyLevel] = useState<
    "autonomous" | "available"
  >("autonomous");

  const openDialog = () => {
    dialogRef.current?.showModal();
  };

  const closeDialog = () => {
    dialogRef.current?.close();
    resetForm();
  };

  const resetForm = () => {
    setGoal("");
    setProjectDir("");
    setAutonomyLevel("autonomous");
    formRef.current?.reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedGoal = goal.trim();
    const trimmedDir = projectDir.trim();
    if (!trimmedGoal || !trimmedDir) return;

    const assignment = await createAssignment(
      trimmedGoal,
      trimmedDir,
      autonomyLevel,
    );
    if ((assignment as Record<string, unknown>).error) {
      alert((assignment as Record<string, unknown>).error);
      return;
    }

    updateAssignment(assignment);
    selectAssignment(assignment.id);
    closeDialog();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      closeDialog();
    }
  };

  return (
    <>
      <button
        title="New Assignment"
        onClick={openDialog}
        className="new-assignment-btn"
      >
        +
      </button>
      <dialog ref={dialogRef} id="new-dialog" onClick={handleBackdropClick}>
        <form ref={formRef} onSubmit={handleSubmit}>
          <h2>New Assignment</h2>
          <label>
            Goal
            <textarea
              rows={4}
              placeholder="What should be accomplished?"
              required
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </label>
          <label>
            Project Directory
            <select
              required
              value={projectDir}
              onChange={(e) => setProjectDir(e.target.value)}
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
          <fieldset className="autonomy-fieldset">
            <legend>Autonomy Level</legend>
            <label className="radio-label">
              <input
                type="radio"
                name="autonomy"
                value="autonomous"
                checked={autonomyLevel === "autonomous"}
                onChange={() => setAutonomyLevel("autonomous")}
              />
              <span>
                <strong>Autonomous</strong>
                <span className="dim"> — fully automatic execution</span>
              </span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="autonomy"
                value="available"
                checked={autonomyLevel === "available"}
                onChange={() => setAutonomyLevel("available")}
              />
              <span>
                <strong>Available</strong>
                <span className="dim"> — pause for decisions</span>
              </span>
            </label>
          </fieldset>
          <div className="dialog-actions">
            <button type="button" onClick={closeDialog}>
              Cancel
            </button>
            <button type="submit">Create</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
