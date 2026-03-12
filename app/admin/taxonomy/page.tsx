"use client";

import { useState, useEffect, useCallback } from "react";

type TaxonomyLevel = "category" | "subject" | "topic" | "subtopic";

interface TaxNode {
  id: string;
  name: string;
  level: TaxonomyLevel;
  parentId?: string;
  children?: TaxNode[];
}

interface TreeCategory {
  id: string;
  name: string;
  subjects: TreeSubject[];
}
interface TreeSubject {
  id: string;
  name: string;
  categoryId: string;
  topics: TreeTopic[];
}
interface TreeTopic {
  id: string;
  name: string;
  subjectId: string;
  subtopics: TreeSubtopic[];
}
interface TreeSubtopic {
  id: string;
  name: string;
  topicId: string;
}

const LEVEL_LABELS: Record<TaxonomyLevel, string> = {
  category: "Category",
  subject: "Subject",
  topic: "Topic",
  subtopic: "Subtopic",
};

const CHILD_LEVELS: Record<string, TaxonomyLevel | null> = {
  category: "subject",
  subject: "topic",
  topic: "subtopic",
  subtopic: null,
};

export default function TaxonomyPage() {
  const [tree, setTree] = useState<TreeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [selected, setSelected] = useState<{ level: TaxonomyLevel; id: string; name: string; parentId?: string } | null>(null);
  const [formMode, setFormMode] = useState<"idle" | "create" | "edit">("idle");
  const [formLevel, setFormLevel] = useState<TaxonomyLevel>("category");
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ level: TaxonomyLevel; id: string; name: string } | null>(null);

  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.user) setUserRole(d.user.role);
    });
  }, []);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/taxonomy?tree=true");
      const data = await res.json();
      setTree(data.data || []);
    } catch {
      showToast("Failed to load taxonomy", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSelect(level: TaxonomyLevel, id: string, name: string, parentId?: string) {
    setSelected({ level, id, name, parentId });
    setFormMode("idle");
    setFormError("");
  }

  function startCreate(level: TaxonomyLevel, parentId?: string) {
    setFormMode("create");
    setFormLevel(level);
    setFormName("");
    setFormParentId(parentId || "");
    setFormError("");
  }

  function startEdit() {
    if (!selected) return;
    setFormMode("edit");
    setFormLevel(selected.level);
    setFormName(selected.name);
    setFormError("");
  }

  async function handleSave() {
    if (!formName.trim()) {
      setFormError("Name is required");
      return;
    }
    setFormSaving(true);
    setFormError("");

    try {
      if (formMode === "create") {
        const res = await fetch("/api/taxonomy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: formLevel, name: formName.trim(), parentId: formParentId || undefined }),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error); return; }
        showToast(`${LEVEL_LABELS[formLevel]} created`, "success");
      } else if (formMode === "edit" && selected) {
        const res = await fetch("/api/taxonomy", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: selected.level, id: selected.id, name: formName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error); return; }
        showToast(`${LEVEL_LABELS[selected.level]} updated`, "success");
        setSelected({ ...selected, name: formName.trim() });
      }
      setFormMode("idle");
      fetchTree();
    } catch {
      setFormError("Something went wrong");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete(force: boolean) {
    if (!deleteConfirm) return;
    const { level, id, name } = deleteConfirm;
    try {
      const res = await fetch(`/api/taxonomy?level=${level}&id=${id}&force=${force}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error, "error");
        return;
      }
      showToast(`${LEVEL_LABELS[level]} "${name}" deleted`, "success");
      if (selected?.id === id) setSelected(null);
      fetchTree();
    } catch {
      showToast("Delete failed", "error");
    } finally {
      setDeleteConfirm(null);
    }
  }

  function filterTree(categories: TreeCategory[], q: string): TreeCategory[] {
    if (!q) return categories;
    const lq = q.toLowerCase();
    return categories
      .map(cat => {
        const catMatch = cat.name.toLowerCase().includes(lq);
        const filteredSubjects = cat.subjects
          .map(sub => {
            const subMatch = sub.name.toLowerCase().includes(lq);
            const filteredTopics = sub.topics
              .map(top => {
                const topMatch = top.name.toLowerCase().includes(lq);
                const filteredSubtopics = top.subtopics.filter(st => st.name.toLowerCase().includes(lq));
                if (topMatch || filteredSubtopics.length > 0) return { ...top, subtopics: topMatch ? top.subtopics : filteredSubtopics };
                return null;
              })
              .filter(Boolean) as TreeTopic[];
            if (subMatch || filteredTopics.length > 0) return { ...sub, topics: subMatch ? sub.topics : filteredTopics };
            return null;
          })
          .filter(Boolean) as TreeSubject[];
        if (catMatch || filteredSubjects.length > 0) return { ...cat, subjects: catMatch ? cat.subjects : filteredSubjects };
        return null;
      })
      .filter(Boolean) as TreeCategory[];
  }

  const filtered = filterTree(tree, search);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", margin: 0 }}>Taxonomy</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => startCreate("category")} style={btnStyle}>+ Category</button>
          <button
            onClick={() => selected && (selected.level === "category") && startCreate("subject", selected.id)}
            disabled={!selected || selected.level !== "category"}
            style={{ ...btnStyle, ...((!selected || selected.level !== "category") ? btnDisabled : {}) }}
          >+ Subject</button>
          <button
            onClick={() => selected && (selected.level === "subject") && startCreate("topic", selected.id)}
            disabled={!selected || selected.level !== "subject"}
            style={{ ...btnStyle, ...((!selected || selected.level !== "subject") ? btnDisabled : {}) }}
          >+ Topic</button>
          <button
            onClick={() => selected && (selected.level === "topic") && startCreate("subtopic", selected.id)}
            disabled={!selected || selected.level !== "topic"}
            style={{ ...btnStyle, ...((!selected || selected.level !== "topic") ? btnDisabled : {}) }}
          >+ Subtopic</button>
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Search taxonomy..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />
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

      <div style={{ display: "flex", gap: "1.5rem", minHeight: "60vh" }}>
        <div style={{ flex: "1 1 50%", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", overflowY: "auto", backgroundColor: "#fff" }}>
          {loading ? (
            <p style={{ color: "#666" }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: "#666" }}>No taxonomy items found. Add a category to get started.</p>
          ) : (
            filtered.map(cat => (
              <TreeItem key={cat.id} level="category" item={cat} expanded={expanded} selected={selected}
                toggleExpand={toggleExpand} handleSelect={handleSelect}>
                {expanded.has(cat.id) && cat.subjects.map(sub => (
                  <TreeItem key={sub.id} level="subject" item={sub} expanded={expanded} selected={selected}
                    toggleExpand={toggleExpand} handleSelect={handleSelect} parentId={cat.id} indent={1}>
                    {expanded.has(sub.id) && sub.topics.map(top => (
                      <TreeItem key={top.id} level="topic" item={top} expanded={expanded} selected={selected}
                        toggleExpand={toggleExpand} handleSelect={handleSelect} parentId={sub.id} indent={2}>
                        {expanded.has(top.id) && top.subtopics.map(st => (
                          <TreeItem key={st.id} level="subtopic" item={st} expanded={expanded} selected={selected}
                            toggleExpand={toggleExpand} handleSelect={handleSelect} parentId={top.id} indent={3} />
                        ))}
                      </TreeItem>
                    ))}
                  </TreeItem>
                ))}
              </TreeItem>
            ))
          )}
        </div>

        <div style={{ flex: "1 1 40%", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1.25rem", backgroundColor: "#fff" }}>
          {formMode === "idle" && !selected && (
            <p style={{ color: "#888", fontSize: "0.875rem" }}>Select an item from the tree or add a new one.</p>
          )}

          {formMode === "idle" && selected && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {LEVEL_LABELS[selected.level]}
                  </span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0.25rem 0" }}>{selected.name}</h2>
                  <p style={{ fontSize: "0.8125rem", color: "#999" }}>ID: {selected.id}</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={startEdit} style={{ ...btnStyle, backgroundColor: "#7c3aed" }}>Edit</button>
                  <button onClick={() => setDeleteConfirm({ level: selected.level, id: selected.id, name: selected.name })}
                    style={{ ...btnStyle, backgroundColor: "#dc2626" }}>Delete</button>
                </div>
              </div>
              {CHILD_LEVELS[selected.level] && (
                <button
                  onClick={() => startCreate(CHILD_LEVELS[selected.level]!, selected.id)}
                  style={{ ...btnStyle, marginTop: "1rem" }}
                >+ Add {LEVEL_LABELS[CHILD_LEVELS[selected.level]!]}</button>
              )}
            </div>
          )}

          {(formMode === "create" || formMode === "edit") && (
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
                {formMode === "create" ? `New ${LEVEL_LABELS[formLevel]}` : `Edit ${LEVEL_LABELS[formLevel]}`}
              </h3>
              {formError && (
                <div style={{ padding: "0.5rem", backgroundColor: "#fef2f2", color: "#dc2626", borderRadius: "4px", fontSize: "0.8125rem", marginBottom: "0.75rem", border: "1px solid #fecaca" }}>
                  {formError}
                </div>
              )}
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem", color: "#333" }}>Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
                style={inputStyle}
                autoFocus
              />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <button onClick={handleSave} disabled={formSaving} style={{ ...btnStyle, backgroundColor: "#059669" }}>
                  {formSaving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => { setFormMode("idle"); setFormError(""); }} style={{ ...btnStyle, backgroundColor: "#6b7280" }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteConfirm && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>Confirm Delete</h3>
            <p style={{ fontSize: "0.875rem", color: "#333", marginBottom: "1rem" }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong> ({LEVEL_LABELS[deleteConfirm.level]})?
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ ...btnStyle, backgroundColor: "#6b7280" }}>Cancel</button>
              <button onClick={() => handleDelete(false)} style={{ ...btnStyle, backgroundColor: "#dc2626" }}>Delete</button>
              {userRole === "SUPER_ADMIN" && (
                <button onClick={() => handleDelete(true)} style={{ ...btnStyle, backgroundColor: "#7c2d12" }}>Force Delete</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TreeItem({
  level, item, expanded, selected, toggleExpand, handleSelect, parentId, indent = 0, children,
}: {
  level: TaxonomyLevel;
  item: { id: string; name: string; subjects?: any[]; topics?: any[]; subtopics?: any[] };
  expanded: Set<string>;
  selected: { level: TaxonomyLevel; id: string } | null;
  toggleExpand: (id: string) => void;
  handleSelect: (level: TaxonomyLevel, id: string, name: string, parentId?: string) => void;
  parentId?: string;
  indent?: number;
  children?: React.ReactNode;
}) {
  const hasChildren = level !== "subtopic" && (
    (level === "category" && (item as any).subjects?.length > 0) ||
    (level === "subject" && (item as any).topics?.length > 0) ||
    (level === "topic" && (item as any).subtopics?.length > 0)
  );

  const isExpanded = expanded.has(item.id);
  const isSelected = selected?.id === item.id;

  const levelColors: Record<TaxonomyLevel, string> = {
    category: "#3b82f6",
    subject: "#8b5cf6",
    topic: "#059669",
    subtopic: "#d97706",
  };

  return (
    <div>
      <div
        onClick={() => handleSelect(level, item.id, item.name, parentId)}
        style={{
          display: "flex", alignItems: "center", gap: "0.375rem",
          padding: "0.375rem 0.5rem", paddingLeft: `${indent * 1.25 + 0.5}rem`,
          cursor: "pointer", borderRadius: "4px", fontSize: "0.875rem",
          backgroundColor: isSelected ? "#eff6ff" : "transparent",
          borderLeft: isSelected ? "3px solid #3b82f6" : "3px solid transparent",
        }}
      >
        {hasChildren ? (
          <span
            onClick={e => { e.stopPropagation(); toggleExpand(item.id); }}
            style={{ cursor: "pointer", fontSize: "0.75rem", width: "1rem", textAlign: "center", color: "#666", userSelect: "none" }}
          >
            {isExpanded ? "▼" : "▶"}
          </span>
        ) : (
          <span style={{ width: "1rem" }} />
        )}
        <span style={{
          display: "inline-block", width: "0.5rem", height: "0.5rem", borderRadius: "50%",
          backgroundColor: levelColors[level], flexShrink: 0,
        }} />
        <span style={{ fontWeight: isSelected ? 600 : 400, color: "#1e293b" }}>{item.name}</span>
        <span style={{ fontSize: "0.6875rem", color: "#94a3b8", marginLeft: "auto" }}>{LEVEL_LABELS[level]}</span>
      </div>
      {children}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "0.375rem 0.75rem", backgroundColor: "#7c3aed", color: "#fff", border: "none",
  borderRadius: "4px", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
};

const btnDisabled: React.CSSProperties = {
  backgroundColor: "#cbd5e1", color: "#94a3b8", cursor: "not-allowed",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.625rem", border: "1px solid #d1d5db", borderRadius: "4px",
  fontSize: "0.875rem", outline: "none", boxSizing: "border-box",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 1000,
};

const modalBox: React.CSSProperties = {
  backgroundColor: "#fff", borderRadius: "8px", padding: "1.5rem", width: "100%",
  maxWidth: "420px", boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
};
