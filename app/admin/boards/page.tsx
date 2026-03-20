"use client";

import { useState, useEffect, useCallback } from "react";

const PURPLE = "#7c3aed";

interface Grade {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  _count: { users: number };
}

interface Board {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  _count: { grades: number; users: number };
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3200); };

  // Board form
  const [boardModal, setBoardModal] = useState<"create" | "edit" | null>(null);
  const [boardForm, setBoardForm] = useState({ name: "", code: "" });
  const [boardSaving, setBoardSaving] = useState(false);
  const [boardError, setBoardError] = useState("");

  // Grade form
  const [gradeModal, setGradeModal] = useState<"create" | "edit" | null>(null);
  const [gradeTarget, setGradeTarget] = useState<Grade | null>(null);
  const [gradeForm, setGradeForm] = useState({ name: "", sortOrder: "0" });
  const [gradeSaving, setGradeSaving] = useState(false);
  const [gradeError, setGradeError] = useState("");

  const loadBoards = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/boards");
    const json = await res.json();
    setBoards(json.data || []);
    setLoading(false);
  }, []);

  const loadGrades = useCallback(async (boardId: string) => {
    setGradesLoading(true);
    const res = await fetch(`/api/boards/${boardId}/grades`);
    const json = await res.json();
    setGrades(json.data || []);
    setGradesLoading(false);
  }, []);

  useEffect(() => { loadBoards(); }, [loadBoards]);

  useEffect(() => {
    if (selectedBoard) loadGrades(selectedBoard.id);
    else setGrades([]);
  }, [selectedBoard, loadGrades]);

  // ── Board CRUD ────────────────────────────────────────────────────────────
  const openCreateBoard = () => {
    setBoardForm({ name: "", code: "" });
    setBoardError("");
    setBoardModal("create");
  };

  const openEditBoard = (b: Board) => {
    setBoardForm({ name: b.name, code: b.code });
    setBoardError("");
    setBoardModal("edit");
    setSelectedBoard(b);
  };

  const saveBoard = async () => {
    setBoardSaving(true); setBoardError("");
    if (boardModal === "create") {
      const res = await fetch("/api/boards", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(boardForm),
      });
      const json = await res.json();
      setBoardSaving(false);
      if (!res.ok) { setBoardError(json.error || "Failed"); return; }
      setBoardModal(null);
      showToast("Board created");
      await loadBoards();
    } else if (boardModal === "edit" && selectedBoard) {
      const res = await fetch(`/api/boards/${selectedBoard.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(boardForm),
      });
      const json = await res.json();
      setBoardSaving(false);
      if (!res.ok) { setBoardError(json.error || "Failed"); return; }
      setBoardModal(null);
      showToast("Board updated");
      await loadBoards();
      if (selectedBoard) setSelectedBoard(prev => prev ? { ...prev, ...json.data } : null);
    }
  };

  const toggleBoard = async (b: Board) => {
    const res = await fetch(`/api/boards/${b.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !b.isActive }),
    });
    if (!res.ok) { showToast("Failed to update board", false); return; }
    showToast(b.isActive ? "Board deactivated" : "Board activated");
    await loadBoards();
  };

  // ── Grade CRUD ────────────────────────────────────────────────────────────
  const openCreateGrade = () => {
    setGradeForm({ name: "", sortOrder: String(grades.length) });
    setGradeError("");
    setGradeTarget(null);
    setGradeModal("create");
  };

  const openEditGrade = (g: Grade) => {
    setGradeForm({ name: g.name, sortOrder: String(g.sortOrder) });
    setGradeError("");
    setGradeTarget(g);
    setGradeModal("edit");
  };

  const saveGrade = async () => {
    if (!selectedBoard) return;
    setGradeSaving(true); setGradeError("");
    if (gradeModal === "create") {
      const res = await fetch(`/api/boards/${selectedBoard.id}/grades`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gradeForm),
      });
      const json = await res.json();
      setGradeSaving(false);
      if (!res.ok) { setGradeError(json.error || "Failed"); return; }
      setGradeModal(null);
      showToast("Grade created");
      await loadGrades(selectedBoard.id);
    } else if (gradeModal === "edit" && gradeTarget) {
      const res = await fetch(`/api/grades/${gradeTarget.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gradeForm),
      });
      const json = await res.json();
      setGradeSaving(false);
      if (!res.ok) { setGradeError(json.error || "Failed"); return; }
      setGradeModal(null);
      showToast("Grade updated");
      await loadGrades(selectedBoard.id);
    }
  };

  const toggleGrade = async (g: Grade) => {
    const res = await fetch(`/api/grades/${g.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !g.isActive }),
    });
    if (!res.ok) { showToast("Failed to update grade", false); return; }
    showToast(g.isActive ? "Grade deactivated" : "Grade activated");
    if (selectedBoard) await loadGrades(selectedBoard.id);
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.875rem", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.3rem", marginTop: "0.75rem" };
  const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
  const modal: React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "1.75rem", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" };
  const primaryBtn: React.CSSProperties = { padding: "0.5rem 1.25rem", borderRadius: "7px", border: "none", background: PURPLE, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.875rem" };
  const cancelBtn: React.CSSProperties = { padding: "0.5rem 1.25rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem" };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>Boards & Grades</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
            Manage education boards and their grade levels used in learner registration.
          </p>
        </div>
        <button onClick={openCreateBoard} style={{ ...primaryBtn, padding: "0.5rem 1rem", fontSize: "0.8125rem" }}>
          + Add Board
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedBoard ? "1fr 1fr" : "1fr", gap: "1.5rem" }}>
        {/* Boards Table */}
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", fontWeight: 700, fontSize: "0.875rem", color: "#374151" }}>
            Boards ({boards.length})
          </div>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
          ) : boards.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>No boards yet. Add your first board.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Board", "Code", "Grades", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {boards.map(b => (
                  <tr key={b.id}
                    style={{ background: selectedBoard?.id === b.id ? "#f5f3ff" : "transparent", cursor: "pointer" }}
                    onClick={() => setSelectedBoard(selectedBoard?.id === b.id ? null : b)}>
                    <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{b.name}</td>
                    <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                      <code style={{ fontSize: "0.75rem", background: "#f1f5f9", padding: "1px 6px", borderRadius: 4 }}>{b.code}</code>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem", color: "#475569" }}>{b._count.grades}</td>
                    <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ padding: "2px 8px", borderRadius: "9px", fontSize: "0.7rem", fontWeight: 700, background: b.isActive ? "#f0fdf4" : "#f1f5f9", color: b.isActive ? "#15803d" : "#94a3b8" }}>
                        {b.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <button onClick={() => openEditBoard(b)} style={{ padding: "0.2rem 0.6rem", borderRadius: "5px", border: `1px solid ${PURPLE}`, color: PURPLE, background: "#fff", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>Edit</button>
                        <button onClick={() => toggleBoard(b)} style={{ padding: "0.2rem 0.6rem", borderRadius: "5px", border: `1px solid ${b.isActive ? "#dc2626" : "#15803d"}`, color: b.isActive ? "#dc2626" : "#15803d", background: "#fff", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>
                          {b.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Grades Panel */}
        {selectedBoard && (
          <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#374151" }}>
                Grades — {selectedBoard.name}
              </span>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button onClick={openCreateGrade} style={{ padding: "0.25rem 0.75rem", borderRadius: "6px", border: "none", background: PURPLE, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "0.75rem" }}>
                  + Add Grade
                </button>
                <button onClick={() => setSelectedBoard(null)} style={{ padding: "0.25rem 0.5rem", borderRadius: "6px", border: "1px solid #e2e8f0", color: "#64748b", background: "#fff", cursor: "pointer", fontSize: "0.75rem" }}>✕</button>
              </div>
            </div>
            {gradesLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
            ) : grades.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>No grades yet for this board.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Grade", "Order", "Learners", "Status", "Actions"].map(h => (
                      <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grades.map(g => (
                    <tr key={g.id}>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{g.name}</td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem", color: "#64748b" }}>{g.sortOrder}</td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem", color: "#64748b" }}>{g._count.users}</td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                        <span style={{ padding: "2px 8px", borderRadius: "9px", fontSize: "0.7rem", fontWeight: 700, background: g.isActive ? "#f0fdf4" : "#f1f5f9", color: g.isActive ? "#15803d" : "#94a3b8" }}>
                          {g.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", gap: "0.3rem" }}>
                          <button onClick={() => openEditGrade(g)} style={{ padding: "0.2rem 0.6rem", borderRadius: "5px", border: `1px solid ${PURPLE}`, color: PURPLE, background: "#fff", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>Edit</button>
                          <button onClick={() => toggleGrade(g)} style={{ padding: "0.2rem 0.6rem", borderRadius: "5px", border: `1px solid ${g.isActive ? "#dc2626" : "#15803d"}`, color: g.isActive ? "#dc2626" : "#15803d", background: "#fff", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>
                            {g.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Board Modal */}
      {boardModal && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.125rem", fontWeight: 700 }}>
              {boardModal === "create" ? "Add Board" : "Edit Board"}
            </h2>
            {boardError && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "0.5rem 0.75rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.875rem" }}>{boardError}</div>}
            <label style={labelStyle}>Board Name *</label>
            <input value={boardForm.name} onChange={e => setBoardForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. CBSE, ICSE, State Board" />
            <label style={labelStyle}>Code *</label>
            <input value={boardForm.code} onChange={e => setBoardForm(f => ({ ...f, code: e.target.value }))} style={inputStyle} placeholder="e.g. CBSE" />
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>Short unique identifier for the board. Will be uppercased automatically.</p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button onClick={saveBoard} disabled={boardSaving} style={primaryBtn}>{boardSaving ? "Saving…" : (boardModal === "create" ? "Create Board" : "Save Changes")}</button>
              <button onClick={() => setBoardModal(null)} style={cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Grade Modal */}
      {gradeModal && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.125rem", fontWeight: 700 }}>
              {gradeModal === "create" ? `Add Grade — ${selectedBoard?.name}` : "Edit Grade"}
            </h2>
            {gradeError && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "0.5rem 0.75rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.875rem" }}>{gradeError}</div>}
            <label style={labelStyle}>Grade Name *</label>
            <input value={gradeForm.name} onChange={e => setGradeForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. Grade 10, Class 11, JEE Year 1" />
            <label style={labelStyle}>Sort Order</label>
            <input type="number" value={gradeForm.sortOrder} onChange={e => setGradeForm(f => ({ ...f, sortOrder: e.target.value }))} style={inputStyle} placeholder="0" />
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>Lower numbers appear first in dropdowns.</p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button onClick={saveGrade} disabled={gradeSaving} style={primaryBtn}>{gradeSaving ? "Saving…" : (gradeModal === "create" ? "Create Grade" : "Save Changes")}</button>
              <button onClick={() => setGradeModal(null)} style={cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", padding: "0.75rem 1.25rem", borderRadius: "8px", background: toast.ok ? "#0f172a" : "#dc2626", color: "#fff", fontSize: "0.875rem", fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
