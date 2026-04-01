"use client";

import { useState, useEffect, useCallback } from "react";

interface ImportJob {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  reportUrl: string | null;
  createdAt: string;
}

interface ImportRow {
  id: string;
  rowNumber: number;
  rawData: Record<string, any>;
  editedData: Record<string, any> | null;
  isValid: boolean;
  errorField: string | null;
  errorMsg: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PREVIEWED: { bg: "#dbeafe", color: "#1e40af" },
  VALIDATED: { bg: "#fef3c7", color: "#92400e" },
  IMPORTED: { bg: "#d1fae5", color: "#065f46" },
  PARTIAL_IMPORTED: { bg: "#fef3c7", color: "#92400e" },
  FAILED: { bg: "#fee2e2", color: "#991b1b" },
};

export default function ImportsPage() {
  const [view, setView] = useState<"list" | "detail">("list");
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [rowPage, setRowPage] = useState(1);
  const [rowTotalPages, setRowTotalPages] = useState(1);
  const [loadingRows, setLoadingRows] = useState(false);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [parserWarnings, setParserWarnings] = useState<string[]>([]);

  const [editRow, setEditRow] = useState<ImportRow | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch("/api/imports?page=1&limit=20");
      const d = await res.json();
      setJobs(d.data || []);
    } catch {
      showToast("Failed to load import jobs", "error");
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const fetchJobDetail = useCallback(async (jobId: string, page: number, errorsOnly: boolean) => {
    setLoadingRows(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (errorsOnly) params.set("errors", "true");
      const res = await fetch(`/api/imports/${jobId}?${params}`);
      const d = await res.json();
      setActiveJob(d.data.job);
      setRows(d.data.rows || []);
      setRowTotalPages(d.data.pagination?.totalPages || 1);
    } catch {
      showToast("Failed to load job details", "error");
    } finally {
      setLoadingRows(false);
    }
  }, []);

  function openJob(job: ImportJob) {
    setActiveJob(job);
    setView("detail");
    setRowPage(1);
    setShowErrorsOnly(false);
    fetchJobDetail(job.id, 1, false);
  }

  useEffect(() => {
    if (activeJob) {
      fetchJobDetail(activeJob.id, rowPage, showErrorsOnly);
    }
  }, [rowPage, showErrorsOnly]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/imports/preview", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || "Upload failed", "error");
        return;
      }
      showToast(`Preview complete: ${d.data.job.totalRows} rows parsed`, "success");
      setActiveJob(d.data.job);
      setRows(d.data.rows || []);
      setParserWarnings(d.data.parserWarnings || []);
      setRowTotalPages(1);
      setView("detail");
      fetchJobs();
    } catch {
      showToast("Upload failed", "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleAction(action: "validate" | "revalidate" | "commit") {
    if (!activeJob) return;
    setActionLoading(action);
    try {
      const url = `/api/imports/${action}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importJobId: activeJob.id }),
      });
      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || `${action} failed`, "error");
        return;
      }

      if (action === "commit") {
        showToast(
          `Imported ${d.data.importedCount} questions. ${d.data.failedCount} failed.`,
          d.data.failedCount > 0 ? "error" : "success"
        );
      } else {
        showToast(
          `Validation: ${d.data.validRows} valid, ${d.data.invalidRows} invalid`,
          "success"
        );
      }

      fetchJobDetail(activeJob.id, rowPage, showErrorsOnly);
      fetchJobs();
    } catch {
      showToast(`${action} failed`, "error");
    } finally {
      setActionLoading("");
    }
  }

  function openEditRow(row: ImportRow) {
    const data = (row.editedData || row.rawData) as Record<string, any>;
    const flat: Record<string, string> = {};
    for (const k of Object.keys(data)) {
      flat[k] = String(data[k] ?? "");
    }
    setEditData(flat);
    setEditRow(row);
  }

  async function saveEditRow() {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/imports/rows/${editRow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedData: editData }),
      });
      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || "Save failed", "error");
        return;
      }
      showToast("Row updated", "success");
      setEditRow(null);
      if (activeJob) fetchJobDetail(activeJob.id, rowPage, showErrorsOnly);
    } catch {
      showToast("Save failed", "error");
    } finally {
      setEditSaving(false);
    }
  }

  const EDIT_FIELDS = [
    "type", "stem", "option1", "option2", "option3", "option4",
    "option5", "option6", "option7", "option8", "correct",
    "explanation", "difficulty", "status", "tags",
    "category", "subject", "topic", "subtopic",
  ];

  if (view === "detail" && activeJob) {
    const canCommit = activeJob.status !== "IMPORTED";
    const sc = STATUS_COLORS[activeJob.status] || { bg: "#f1f5f9", color: "#475569" };

    return (
      <div style={{ fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", margin: 0 }}>
            Import: {activeJob.fileName}
          </h1>
          <button onClick={() => { setView("list"); setActiveJob(null); }} style={{ ...btnStyle, backgroundColor: "#6b7280" }}>
            Back to List
          </button>
        </div>

        {toast && (
          <div style={{
            padding: "0.625rem 1rem", marginBottom: "1rem", borderRadius: "4px",
            backgroundColor: toast.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: toast.type === "success" ? "#059669" : "#dc2626",
            border: `1px solid ${toast.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            fontSize: "0.875rem",
          }}>
            {toast.msg}
          </div>
        )}

        {parserWarnings.length > 0 && (
          <div style={{
            padding: "0.875rem 1rem", marginBottom: "1rem", borderRadius: "6px",
            backgroundColor: "#fffbeb", border: "1px solid #fbbf24",
            fontSize: "0.82rem", color: "#78350f",
          }}>
            <div style={{ fontWeight: 700, marginBottom: "0.35rem", color: "#92400e" }}>
              Smart Parser Active
            </div>
            {parserWarnings.map((w, i) => (
              <div key={i} style={{ marginBottom: i < parserWarnings.length - 1 ? "0.25rem" : 0 }}>
                {w}
              </div>
            ))}
            <div style={{ marginTop: "0.5rem", color: "#92400e", fontSize: "0.78rem" }}>
              Tip: For best results, use the downloadable template and ensure each field is on its own paragraph in Word.
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={cardStyle}>
            <div style={{ fontSize: "0.6875rem", color: "#6b7280", textTransform: "uppercase" }}>Status</div>
            <span style={{ display: "inline-block", padding: "0.125rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600, backgroundColor: sc.bg, color: sc.color, marginTop: "0.25rem" }}>
              {activeJob.status}
            </span>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: "0.6875rem", color: "#6b7280", textTransform: "uppercase" }}>Total Rows</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111" }}>{activeJob.totalRows}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: "0.6875rem", color: "#6b7280", textTransform: "uppercase" }}>Valid</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669" }}>{activeJob.validRows}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: "0.6875rem", color: "#6b7280", textTransform: "uppercase" }}>Invalid</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#dc2626" }}>{activeJob.invalidRows}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: "0.6875rem", color: "#6b7280", textTransform: "uppercase" }}>Type</div>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#111" }}>{activeJob.fileType}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => handleAction("validate")}
            disabled={!!actionLoading}
            style={{ ...btnStyle, backgroundColor: "#7c3aed" }}
          >
            {actionLoading === "validate" ? "Validating..." : "Validate"}
          </button>
          <button
            onClick={() => handleAction("revalidate")}
            disabled={!!actionLoading}
            style={{ ...btnStyle, backgroundColor: "#7c3aed" }}
          >
            {actionLoading === "revalidate" ? "Re-validating..." : "Re-validate"}
          </button>
          <button
            onClick={() => handleAction("commit")}
            disabled={!!actionLoading || !canCommit}
            style={{
              ...btnStyle,
              backgroundColor: canCommit ? "#059669" : "#cbd5e1",
              color: canCommit ? "#fff" : "#94a3b8",
            }}
          >
            {actionLoading === "commit" ? "Importing..." : "Import Valid Rows"}
          </button>
          {activeJob.reportUrl && (
            <a
              href={activeJob.reportUrl}
              download
              style={{ ...btnStyle, backgroundColor: "#dc2626", textDecoration: "none", display: "inline-block" }}
            >
              Download Error Report
            </a>
          )}
          <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "#6b7280", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showErrorsOnly}
              onChange={(e) => { setShowErrorsOnly(e.target.checked); setRowPage(1); }}
            />
            Show errors only
          </label>
        </div>

        <div style={cardStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Stem</th>
                <th style={thStyle}>Valid</th>
                <th style={thStyle}>Error</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>No rows to display.</td></tr>
              ) : (
                rows.map((row) => {
                  const data = (row.editedData || row.rawData) as Record<string, any>;
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: row.isValid ? "transparent" : "#fff5f5" }}>
                      <td style={tdStyle}>{row.rowNumber}</td>
                      <td style={tdStyle}>{data.type || "-"}</td>
                      <td style={{ ...tdStyle, maxWidth: "300px" }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {data.stem || "-"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-block", padding: "0.125rem 0.375rem", borderRadius: "9999px",
                          fontSize: "0.6875rem", fontWeight: 500,
                          backgroundColor: row.isValid ? "#d1fae5" : "#fee2e2",
                          color: row.isValid ? "#065f46" : "#991b1b",
                        }}>
                          {row.isValid ? "Valid" : "Invalid"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: "200px", fontSize: "0.75rem", color: "#dc2626" }}>
                        {row.errorMsg ? (
                          <span>
                            {row.errorField && <strong>[{row.errorField}]</strong>} {row.errorMsg}
                          </span>
                        ) : "-"}
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => openEditRow(row)} style={{ ...btnSmall, backgroundColor: "#7c3aed" }}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {rowTotalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setRowPage((p) => Math.max(1, p - 1))} disabled={rowPage <= 1} style={{ ...btnSmall, backgroundColor: rowPage <= 1 ? "#e2e8f0" : "#7c3aed", color: rowPage <= 1 ? "#94a3b8" : "#fff" }}>
                Prev
              </button>
              <span style={{ fontSize: "0.8125rem", color: "#666" }}>Page {rowPage} of {rowTotalPages}</span>
              <button onClick={() => setRowPage((p) => Math.min(rowTotalPages, p + 1))} disabled={rowPage >= rowTotalPages} style={{ ...btnSmall, backgroundColor: rowPage >= rowTotalPages ? "#e2e8f0" : "#7c3aed", color: rowPage >= rowTotalPages ? "#94a3b8" : "#fff" }}>
                Next
              </button>
            </div>
          )}
        </div>

        {editRow && (
          <div style={modalOverlay}>
            <div style={{ ...modalBox, maxWidth: "600px", maxHeight: "80vh", overflowY: "auto" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>
                Edit Row #{editRow.rowNumber}
              </h3>
              {editRow.errorMsg && (
                <div style={{ padding: "0.5rem", backgroundColor: "#fef2f2", color: "#dc2626", borderRadius: "4px", fontSize: "0.75rem", marginBottom: "0.75rem", border: "1px solid #fecaca" }}>
                  <strong>[{editRow.errorField}]</strong> {editRow.errorMsg}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {EDIT_FIELDS.map((field) => (
                  <div key={field} style={{ gridColumn: field === "stem" || field === "explanation" ? "1 / -1" : undefined }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: "0.125rem", color: editRow.errorField === field ? "#dc2626" : "#374151" }}>
                      {field}
                    </label>
                    {field === "stem" || field === "explanation" ? (
                      <textarea
                        value={editData[field] || ""}
                        onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                        rows={2}
                        style={{ ...inputStyle, resize: "vertical", borderColor: editRow.errorField === field ? "#dc2626" : "#d1d5db" }}
                      />
                    ) : (
                      <input
                        type="text"
                        value={editData[field] || ""}
                        onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                        style={{ ...inputStyle, borderColor: editRow.errorField === field ? "#dc2626" : "#d1d5db" }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button onClick={() => setEditRow(null)} style={{ ...btnStyle, backgroundColor: "#6b7280" }}>Cancel</button>
                <button onClick={saveEditRow} disabled={editSaving} style={{ ...btnStyle, backgroundColor: "#059669" }}>
                  {editSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", margin: 0 }}>Imports</h1>
      </div>

      {toast && (
        <div style={{
          padding: "0.625rem 1rem", marginBottom: "1rem", borderRadius: "4px",
          backgroundColor: toast.type === "success" ? "#ecfdf5" : "#fef2f2",
          color: toast.type === "success" ? "#059669" : "#dc2626",
          border: `1px solid ${toast.type === "success" ? "#a7f3d0" : "#fecaca"}`,
          fontSize: "0.875rem",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Download Templates ──────────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: "1rem", padding: "1rem 1.25rem" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#374151", marginBottom: "0.5rem" }}>
          Download Templates
        </div>
        <div style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: "0.75rem" }}>
          Use the <strong>Single Question</strong> template for standalone MCQs. Use the <strong>Paragraph/Group</strong> template when multiple questions share a reading passage.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <a href="/downloads/saphala_single_question_template_v3.docx" download
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.375rem 0.75rem", background: "#7c3aed", color: "#fff", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 600, textDecoration: "none" }}>
            Single Question Template
          </a>
          <a href="/downloads/saphala_group_question_template_v3.docx" download
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.375rem 0.75rem", background: "#0369a1", color: "#fff", borderRadius: "6px", fontSize: "0.78rem", fontWeight: 600, textDecoration: "none" }}>
            Paragraph / Group Question Template
          </a>
        </div>
      </div>

      {/* ── Instructions ────────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: "1rem", padding: "1.125rem 1.25rem" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#374151", marginBottom: "1rem" }}>
          How to Format Your DOCX
        </div>

        {/* Step 1 — Structure */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#7c3aed", marginBottom: "0.4rem" }}>
            Step 1 — Question Block Structure
          </div>
          <div style={{ fontSize: "0.775rem", color: "#374151", lineHeight: 1.6, marginBottom: "0.5rem" }}>
            Each question must be wrapped in a <strong>QUESTION</strong> … <strong>END_QUESTION</strong> block. Every field label must be on its <strong>own paragraph</strong> — press <strong>Enter</strong> (not Shift+Enter) between each one.
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.625rem 0.875rem", fontFamily: "monospace", fontSize: "0.73rem", color: "#1e293b", lineHeight: 1.8 }}>
            <span style={{ color: "#7c3aed", fontWeight: 700 }}>QUESTION</span><br />
            <span style={{ color: "#1e293b" }}>Question:  What is the capital of France?</span><br />
            <span style={{ color: "#1e293b" }}>Option A:  Berlin</span><br />
            <span style={{ color: "#1e293b" }}>Option B:  Madrid</span><br />
            <span style={{ color: "#1e293b" }}>Option C:  Paris</span><br />
            <span style={{ color: "#1e293b" }}>Option D:  Rome</span><br />
            <span style={{ color: "#059669", fontWeight: 600 }}>Correct Answer:  C</span><br />
            <span style={{ color: "#64748b" }}>Type:  MCQ_SINGLE</span><br />
            <span style={{ color: "#64748b" }}>Difficulty:  EASY</span><br />
            <span style={{ color: "#64748b" }}>Category:  General Knowledge</span><br />
            <span style={{ color: "#64748b" }}>Subject:  World Geography</span><br />
            <span style={{ color: "#64748b" }}>Topic:  Capitals of the World</span><br />
            <span style={{ color: "#94a3b8" }}>Subtopic:  European Capitals  (optional)</span><br />
            <span style={{ color: "#64748b" }}>Explanation:  Paris is the capital and largest city of France.</span><br />
            <span style={{ color: "#7c3aed", fontWeight: 700 }}>END_QUESTION</span>
          </div>
        </div>

        {/* Required vs Optional fields */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#7c3aed", marginBottom: "0.5rem" }}>
            Step 2 — Required and Optional Fields
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "0.625rem 0.875rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#065f46", marginBottom: "0.4rem" }}>Required</div>
              {[
                ["QUESTION", "Block start marker (standalone line)"],
                ["Question:", "The question stem text"],
                ["Option A: / Option B:", "Minimum 2 options for MCQ"],
                ["Correct Answer:", "Letter(s): A  or  A,C  for multi-correct"],
                ["Difficulty:", "FOUNDATIONAL · EASY · MEDIUM · HARD"],
                ["Type:", "MCQ_SINGLE · MCQ_MULTIPLE · TRUE_FALSE"],
              ].map(([field, desc]) => (
                <div key={field} style={{ marginBottom: "0.3rem", fontSize: "0.73rem", color: "#1e293b" }}>
                  <code style={{ background: "#dcfce7", padding: "1px 5px", borderRadius: "3px", fontWeight: 600 }}>{field}</code>
                  <span style={{ color: "#6b7280", marginLeft: "0.4rem" }}>{desc}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.625rem 0.875rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", marginBottom: "0.4rem" }}>Optional</div>
              {[
                ["Option C: / Option D:", "Up to 8 options total (Option A–H)"],
                ["Explanation:", "Explanation of the correct answer"],
                ["Category:", "Exam category (e.g. Banking, UPSC)"],
                ["Subject:", "Subject name"],
                ["Topic:", "Topic name"],
                ["Subtopic:", "Subtopic name (can be omitted)"],
                ["Tags:", "Comma-separated tags"],
                ["Marks:", "Points for correct answer (default: 1)"],
                ["Negative Marks:", "Points deducted for wrong (default: 0)"],
                ["Status:", "DRAFT (default) or APPROVED"],
                ["END_QUESTION", "Block end (auto-detected if omitted)"],
              ].map(([field, desc]) => (
                <div key={field} style={{ marginBottom: "0.3rem", fontSize: "0.73rem", color: "#1e293b" }}>
                  <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: "3px", fontWeight: 600 }}>{field}</code>
                  <span style={{ color: "#6b7280", marginLeft: "0.4rem" }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Valid values */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#7c3aed", marginBottom: "0.4rem" }}>
            Valid Field Values
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.73rem", color: "#374151" }}>
            {[
              ["Type", "MCQ_SINGLE  ·  MCQ_MULTIPLE  ·  TRUE_FALSE  ·  FILL_BLANKS  ·  DRAG_DROP  ·  DRAG_REORDER"],
              ["Difficulty", "FOUNDATIONAL  ·  EASY  ·  MEDIUM  ·  HARD  ·  PROFICIENT  ·  MASTERY"],
              ["Status", "DRAFT  (default)  ·  APPROVED"],
              ["Correct Answer", "Single: A  ·  Multiple correct: A,C  (comma-separated, no spaces needed)"],
            ].map(([label, vals]) => (
              <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "5px", padding: "0.5rem 0.7rem" }}>
                <div style={{ fontWeight: 700, color: "#374151", marginBottom: "0.2rem" }}>{label}</div>
                <div style={{ color: "#6b7280", lineHeight: 1.5 }}>{vals}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bilingual */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#059669", marginBottom: "0.35rem" }}>
            Bilingual Questions (Optional)
          </div>
          <div style={{ fontSize: "0.775rem", color: "#374151", lineHeight: 1.6, marginBottom: "0.4rem" }}>
            Add a secondary-language translation for any field by placing the corresponding <strong>Secondary</strong> label immediately after the primary label. All secondary fields are optional — omit any you don't need.
          </div>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "0.5rem 0.875rem", fontFamily: "monospace", fontSize: "0.72rem", color: "#1e293b", lineHeight: 1.8 }}>
            <span>Question:  A train travels 90 km in 2 hours.</span><br />
            <span style={{ color: "#059669" }}>Question Secondary:  एक ट्रेन 2 घंटे में 90 किमी की दूरी तय करती है।</span><br />
            <span>Option A:  45 km/h</span><br />
            <span style={{ color: "#059669" }}>Option A Secondary:  45 किमी/घंटा</span><br />
            <span>Explanation:  Speed = 90 ÷ 2 = 45 km/h.</span><br />
            <span style={{ color: "#059669" }}>Explanation Secondary:  गति = 90 ÷ 2 = 45 किमी/घंटा।</span>
          </div>
        </div>

        {/* Images + common mistakes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "0.625rem 0.875rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#92400e", marginBottom: "0.35rem" }}>
              Images in Questions
            </div>
            <div style={{ fontSize: "0.73rem", color: "#78350f", lineHeight: 1.55, marginBottom: "0.4rem" }}>
              Do <strong>not</strong> paste or embed images in Word. Instead, place an image token anywhere in a Question, Option, or Explanation field:
            </div>
            <code style={{ display: "block", background: "#fef3c7", padding: "4px 7px", borderRadius: "4px", fontSize: "0.7rem", color: "#92400e", wordBreak: "break-all" }}>
              [IMAGE: https://cdn.saphala.in/q/chart.png]
            </code>
          </div>
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.625rem 0.875rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#991b1b", marginBottom: "0.35rem" }}>
              Common Mistakes to Avoid
            </div>
            {[
              "Using Shift+Enter (soft line break) instead of Enter between fields",
              "Forgetting the standalone QUESTION marker before each question",
              "Entering an invalid Difficulty value (check the list above)",
              "Correct Answer letter not matching any option (e.g. 'E' when only A–D exist)",
              "Embedding images directly in the Word file instead of using [IMAGE: URL]",
            ].map((m, i) => (
              <div key={i} style={{ fontSize: "0.72rem", color: "#7f1d1d", marginBottom: "0.2rem", display: "flex", gap: "0.3rem" }}>
                <span style={{ color: "#dc2626", flexShrink: 0 }}>✕</span>
                <span>{m}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Upload Workflow ──────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginBottom: "1rem", padding: "1rem 1.25rem" }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#374151", marginBottom: "0.75rem" }}>
          Upload Workflow
        </div>
        <div style={{ display: "flex", gap: "0", marginBottom: "1rem", flexWrap: "wrap" }}>
          {[
            ["1", "Download & fill template", "Use the template above, fill in your questions, save as .docx"],
            ["2", "Upload file", "Click 'Choose File' and select your .docx or .csv"],
            ["3", "Review preview", "Check for red rows — use the Edit button to fix errors inline"],
            ["4", "Validate", "Click Validate to re-run checks after any edits"],
            ["5", "Import", "Click 'Import Valid Rows' to save questions to the Question Bank"],
          ].map(([num, title, desc], i, arr) => (
            <div key={num} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", flex: "1 1 160px", minWidth: "140px", paddingRight: i < arr.length - 1 ? "0.75rem" : 0 }}>
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#7c3aed", color: "#fff", fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                {num}
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>{title}</div>
                <div style={{ fontSize: "0.7rem", color: "#6b7280", lineHeight: 1.45, marginTop: "0.15rem" }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "0.875rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ ...btnStyle, backgroundColor: uploading ? "#94a3b8" : "#7c3aed", cursor: uploading ? "wait" : "pointer", display: "inline-block" }}>
            {uploading ? "Processing..." : "Choose File to Upload"}
            <input
              type="file"
              accept=".csv,.docx"
              onChange={handleUpload}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
            Supported formats: <strong>.docx</strong> (up to 5,000 questions) · <strong>.csv</strong>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#111", marginBottom: "0.75rem" }}>Previous Imports</h2>

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              <th style={thStyle}>File</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Valid</th>
              <th style={thStyle}>Invalid</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingJobs ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading...</td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>No imports yet. Upload a file to get started.</td></tr>
            ) : (
              jobs.map((job) => {
                const sc = STATUS_COLORS[job.status] || { bg: "#f1f5f9", color: "#475569" };
                return (
                  <tr key={job.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={tdStyle}>{job.fileName}</td>
                    <td style={tdStyle}>{job.fileType}</td>
                    <td style={tdStyle}>
                      <span style={{ display: "inline-block", padding: "0.125rem 0.375rem", borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 500, backgroundColor: sc.bg, color: sc.color }}>
                        {job.status}
                      </span>
                    </td>
                    <td style={tdStyle}>{job.totalRows}</td>
                    <td style={{ ...tdStyle, color: "#059669" }}>{job.validRows}</td>
                    <td style={{ ...tdStyle, color: "#dc2626" }}>{job.invalidRows}</td>
                    <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#6b7280" }}>
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => openJob(job)} style={{ ...btnSmall, backgroundColor: "#7c3aed" }}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "0.375rem 0.75rem", backgroundColor: "#7c3aed", color: "#fff", border: "none",
  borderRadius: "4px", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
};
const btnSmall: React.CSSProperties = {
  padding: "0.1875rem 0.5rem", backgroundColor: "#7c3aed", color: "#fff", border: "none",
  borderRadius: "3px", fontSize: "0.75rem", cursor: "pointer",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.375rem 0.5rem", border: "1px solid #d1d5db", borderRadius: "4px",
  fontSize: "0.8125rem", outline: "none", boxSizing: "border-box",
};
const cardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", backgroundColor: "#fff",
};
const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "0.5rem 0.625rem", fontSize: "0.75rem", fontWeight: 600,
  color: "#475569", textTransform: "uppercase", letterSpacing: "0.03em",
};
const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.625rem", verticalAlign: "middle",
};
const modalOverlay: React.CSSProperties = {
  position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 1000,
};
const modalBox: React.CSSProperties = {
  backgroundColor: "#fff", borderRadius: "8px", padding: "1.5rem", width: "100%",
  maxWidth: "420px", boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
};
