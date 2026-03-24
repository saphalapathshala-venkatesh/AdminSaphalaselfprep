"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CONTROLLED_PALETTE, getSafeSubjectColor } from "@/lib/subjectColors";

// Hierarchy: Category → Subject → Topic → Subtopic
type TaxonomyLevel = "category" | "subject" | "topic" | "subtopic";

const LEVEL_LABELS: Record<TaxonomyLevel, string> = {
  category: "Category",
  subject:  "Subject",
  topic:    "Topic",
  subtopic: "Subtopic",
};

const CHILD_LEVELS: Record<TaxonomyLevel, TaxonomyLevel | null> = {
  category: "subject",
  subject:  "topic",
  topic:    "subtopic",
  subtopic: null,
};

const LEVEL_COLORS: Record<TaxonomyLevel, string> = {
  category: "#0ea5e9",
  subject:  "#8b5cf6",
  topic:    "#059669",
  subtopic: "#d97706",
};

interface TaxNode {
  id: string;
  name: string;
  level: TaxonomyLevel;
  parentId?: string;
  subjectColor?: string | null;
  isShared?: boolean;
  ownerCategoryName?: string;
}

interface TreeSubtopic { id: string; name: string; topicId: string; }
interface TreeTopic    { id: string; name: string; subjectId: string; subtopics: TreeSubtopic[]; }

interface TreeSubject {
  id: string;
  name: string;
  categoryId: string;
  subjectColor?: string | null;
  topics: TreeTopic[];
  // for shared subjects rendered from junction
  isShared?: boolean;
  ownerCategoryName?: string;
}

interface TreeCategorySubjectJunction {
  id: string;
  categoryId: string;
  subjectId: string;
  subject: TreeSubject & { category: { id: string; name: string } };
}

interface TreeCategory {
  id: string;
  name: string;
  subjects: TreeSubject[];
  categorySubjects: TreeCategorySubjectJunction[];
}

interface SecondaryCategory { id: string; name: string; }

export default function TaxonomyPage() {
  const [categories, setCategories] = useState<TreeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [selected, setSelected] = useState<TaxNode | null>(null);
  const [selectedSecondaryCategories, setSelectedSecondaryCategories] = useState<SecondaryCategory[]>([]);

  const [formMode, setFormMode] = useState<"idle" | "create" | "edit">("idle");
  const [formLevel, setFormLevel] = useState<TaxonomyLevel>("category");
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [formSubjectColor, setFormSubjectColor] = useState("");
  const [formSecondaryCategoryIds, setFormSecondaryCategoryIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formPrimaryCategory, setFormPrimaryCategory] = useState<{ id: string; name: string } | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TaxNode | null>(null);
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
      setCategories(data.data || []);
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

  async function handleSelect(level: TaxonomyLevel, id: string, name: string, parentId?: string, extra?: Partial<TaxNode>) {
    setSelected({ level, id, name, parentId, ...extra });
    setFormMode("idle");
    setFormError("");
    setSelectedSecondaryCategories([]);

    // Load secondary categories for subjects
    if (level === "subject") {
      try {
        const res = await fetch(`/api/taxonomy?level=subject&id=${id}`);
        const d = await res.json();
        if (d.data?.categorySubjects) {
          setSelectedSecondaryCategories(d.data.categorySubjects.map((cs: any) => cs.category));
        }
      } catch { /* silent */ }
    }
  }

  function startCreate(level: TaxonomyLevel, parentId?: string) {
    setFormMode("create");
    setFormLevel(level);
    setFormName("");
    setFormParentId(parentId || "");
    setFormSubjectColor("");
    setFormSecondaryCategoryIds([]);
    setFormError("");
    setSelected(null);
    setSelectedSecondaryCategories([]);

    // Find primary category name for display
    if (level === "subject" && parentId) {
      const cat = categories.find(c => c.id === parentId);
      setFormPrimaryCategory(cat ? { id: cat.id, name: cat.name } : null);
    } else {
      setFormPrimaryCategory(null);
    }
  }

  async function startEdit() {
    if (!selected) return;
    setFormMode("edit");
    setFormLevel(selected.level);
    setFormName(selected.name);
    setFormSubjectColor(selected.subjectColor || "");
    setFormSecondaryCategoryIds(selectedSecondaryCategories.map(c => c.id));
    setFormError("");

    if (selected.level === "subject") {
      // Find primary category
      const cat = categories.find(c =>
        c.subjects.some(s => s.id === selected.id) ||
        c.id === selected.parentId
      );
      setFormPrimaryCategory(cat ? { id: cat.id, name: cat.name } : null);
    }
  }

  async function handleSave() {
    if (!formName.trim()) { setFormError("Name is required"); return; }
    setFormSaving(true);
    setFormError("");
    try {
      if (formMode === "create") {
        const body: Record<string, any> = {
          level: formLevel,
          name: formName.trim(),
          parentId: formParentId || undefined,
        };
        if (formLevel === "subject") {
          body.subjectColor = formSubjectColor || undefined;
          body.secondaryCategoryIds = formSecondaryCategoryIds;
        }
        const res = await fetch("/api/taxonomy", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error || "Failed to create"); return; }
        showToast(`${LEVEL_LABELS[formLevel]} created`, "success");
      } else if (formMode === "edit" && selected) {
        const body: Record<string, any> = { level: selected.level, id: selected.id, name: formName.trim() };
        if (selected.level === "subject") {
          body.subjectColor = formSubjectColor || null;
          body.secondaryCategoryIds = formSecondaryCategoryIds;
        }
        const res = await fetch("/api/taxonomy", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error || "Failed to update"); return; }
        showToast(`${LEVEL_LABELS[selected.level]} updated`, "success");
        setSelected({ ...selected, name: formName.trim(), subjectColor: formSubjectColor || null });
        setSelectedSecondaryCategories(
          categories.filter(c => formSecondaryCategoryIds.includes(c.id))
            .map(c => ({ id: c.id, name: c.name }))
        );
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
      if (!res.ok) { showToast(data.error, "error"); return; }
      showToast(`${LEVEL_LABELS[level]} "${name}" deleted`, "success");
      if (selected?.id === id) setSelected(null);
      fetchTree();
    } catch {
      showToast("Delete failed", "error");
    } finally {
      setDeleteConfirm(null);
    }
  }

  function filterCategories(cats: TreeCategory[], q: string): TreeCategory[] {
    if (!q) return cats;
    const lq = q.toLowerCase();
    return cats.map(cat => {
      const cMatch = cat.name.toLowerCase().includes(lq);
      const allSubs = getMergedSubjects(cat);
      const filteredSubs = allSubs.map(sub => {
        const sMatch = sub.name.toLowerCase().includes(lq);
        const filteredTopics = sub.topics.map(top => {
          const tMatch = top.name.toLowerCase().includes(lq);
          const filteredSts = top.subtopics.filter(st => st.name.toLowerCase().includes(lq));
          if (tMatch || filteredSts.length) return { ...top, subtopics: tMatch ? top.subtopics : filteredSts };
          return null;
        }).filter(Boolean) as TreeTopic[];
        if (sMatch || filteredTopics.length) return { ...sub, topics: sMatch ? sub.topics : filteredTopics };
        return null;
      }).filter(Boolean) as TreeSubject[];
      if (cMatch || filteredSubs.length) return {
        ...cat,
        subjects: cMatch ? cat.subjects : filteredSubs.filter(s => !s.isShared),
        categorySubjects: cMatch
          ? cat.categorySubjects
          : cat.categorySubjects.filter(cs => filteredSubs.some(s => s.isShared && s.id === cs.subject.id)),
      };
      return null;
    }).filter(Boolean) as TreeCategory[];
  }

  function getMergedSubjects(cat: TreeCategory): TreeSubject[] {
    const direct = cat.subjects.map(s => ({ ...s, isShared: false }));
    const seen = new Set(direct.map(s => s.id));
    const shared = (cat.categorySubjects || [])
      .filter(cs => !seen.has(cs.subject.id))
      .map(cs => ({
        ...cs.subject,
        isShared: true,
        ownerCategoryName: cs.subject.category?.name,
      }));
    return [...direct, ...shared].sort((a, b) => a.name.localeCompare(b.name));
  }

  function toggleSecondaryCategory(catId: string) {
    setFormSecondaryCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  }

  const filtered = filterCategories(categories, search);

  const canAddSubject  = selected?.level === "category";
  const canAddTopic    = selected?.level === "subject";
  const canAddSubtopic = selected?.level === "topic";

  // Categories available as secondary (exclude primary category of current subject)
  const secondaryCategoryOptions = categories.filter(c =>
    formPrimaryCategory ? c.id !== formPrimaryCategory.id : true
  );

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", margin: 0 }}>Taxonomy</h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "#64748b" }}>
            Category → Subject → Topic → Subtopic
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => startCreate("category")} style={btnStyle}>+ Category</button>
          <button
            onClick={() => canAddSubject && startCreate("subject", selected!.id)}
            disabled={!canAddSubject}
            style={{ ...btnStyle, ...(!canAddSubject ? btnDisabled : {}) }}
          >+ Subject</button>
          <button
            onClick={() => canAddTopic && startCreate("topic", selected!.id)}
            disabled={!canAddTopic}
            style={{ ...btnStyle, ...(!canAddTopic ? btnDisabled : {}) }}
          >+ Topic</button>
          <button
            onClick={() => canAddSubtopic && startCreate("subtopic", selected!.id)}
            disabled={!canAddSubtopic}
            style={{ ...btnStyle, ...(!canAddSubtopic ? btnDisabled : {}) }}
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
        {/* Tree panel */}
        <div style={{ flex: "1 1 55%", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", overflowY: "auto", backgroundColor: "#fff" }}>
          {loading ? (
            <p style={{ color: "#666" }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: "#666" }}>No categories yet. Add a Category to get started.</p>
          ) : (
            filtered.map(cat => (
              <TreeNode key={cat.id} level="category" id={cat.id} name={cat.name}
                expanded={expanded} selected={selected}
                toggleExpand={toggleExpand} handleSelect={handleSelect} indent={0}>
                {expanded.has(cat.id) && getMergedSubjects(cat).map(sub => (
                  <TreeNode
                    key={`${cat.id}-${sub.id}`}
                    level="subject" id={sub.id} name={sub.name}
                    subjectColor={sub.subjectColor}
                    isShared={sub.isShared}
                    sharedFrom={sub.isShared ? sub.ownerCategoryName : undefined}
                    expanded={expanded} selected={selected}
                    toggleExpand={toggleExpand} handleSelect={handleSelect}
                    parentId={cat.id} indent={1}>
                    {expanded.has(sub.id) && sub.topics.map(top => (
                      <TreeNode key={top.id} level="topic" id={top.id} name={top.name}
                        expanded={expanded} selected={selected}
                        toggleExpand={toggleExpand} handleSelect={handleSelect}
                        parentId={sub.id} indent={2}>
                        {expanded.has(top.id) && top.subtopics.map(st => (
                          <TreeNode key={st.id} level="subtopic" id={st.id} name={st.name}
                            expanded={expanded} selected={selected}
                            toggleExpand={toggleExpand} handleSelect={handleSelect}
                            parentId={top.id} indent={3} />
                        ))}
                      </TreeNode>
                    ))}
                  </TreeNode>
                ))}
              </TreeNode>
            ))
          )}
        </div>

        {/* Detail / Form panel */}
        <div style={{ flex: "1 1 40%", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1.25rem", backgroundColor: "#fff", overflowY: "auto", maxHeight: "80vh" }}>
          {formMode === "idle" && !selected && (
            <p style={{ color: "#888", fontSize: "0.875rem" }}>Select an item from the tree or use the buttons above to add new items.</p>
          )}

          {formMode === "idle" && selected && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    {LEVEL_LABELS[selected.level]}
                    {selected.isShared && (
                      <span style={{ marginLeft: "0.5rem", fontSize: "0.65rem", background: "#ede9fe", color: "#7c3aed", borderRadius: "3px", padding: "1px 5px" }}>
                        Shared
                      </span>
                    )}
                  </span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0.25rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {selected.level === "subject" && selected.subjectColor && (
                      <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: selected.subjectColor, display: "inline-block", flexShrink: 0 }} />
                    )}
                    {selected.name}
                  </h2>
                  <p style={{ fontSize: "0.8125rem", color: "#999", margin: 0 }}>ID: {selected.id}</p>
                  {selected.isShared && selected.ownerCategoryName && (
                    <p style={{ fontSize: "0.8rem", color: "#7c3aed", margin: "0.25rem 0 0" }}>
                      Owner: {selected.ownerCategoryName}
                    </p>
                  )}
                  {selected.level === "subject" && selected.subjectColor && (
                    <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0.25rem 0 0" }}>
                      Color: <code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: "3px" }}>{selected.subjectColor}</code>
                    </p>
                  )}
                  {selected.level === "subject" && selectedSecondaryCategories.length > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 0.25rem" }}>Also available under:</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {selectedSecondaryCategories.map(c => (
                          <span key={c.id} style={{ fontSize: "0.75rem", background: "#ede9fe", color: "#7c3aed", borderRadius: "3px", padding: "2px 6px" }}>
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, marginLeft: "0.75rem" }}>
                  <button onClick={startEdit} style={{ ...btnStyle, backgroundColor: "#7c3aed" }}>Edit</button>
                  <button onClick={() => setDeleteConfirm(selected)} style={{ ...btnStyle, backgroundColor: "#dc2626" }}>Delete</button>
                </div>
              </div>
              {CHILD_LEVELS[selected.level] && (
                <button
                  onClick={() => startCreate(CHILD_LEVELS[selected.level]!, selected.id)}
                  style={{ ...btnStyle, marginTop: "1rem" }}
                >
                  + Add {LEVEL_LABELS[CHILD_LEVELS[selected.level]!]}
                </button>
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

              <label style={labelStyle}>Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
                style={inputStyle}
                autoFocus
              />

              {/* Subject-specific fields */}
              {formLevel === "subject" && (
                <>
                  {formPrimaryCategory && (
                    <div style={{ marginTop: "0.75rem" }}>
                      <label style={labelStyle}>Primary Category</label>
                      <div style={{ fontSize: "0.875rem", color: "#374151", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px", padding: "0.5rem 0.625rem" }}>
                        {formPrimaryCategory.name}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: "0.75rem" }}>
                    <label style={labelStyle}>Subject Color</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      {/* Preview swatch */}
                      <div style={{
                        width: "28px", height: "28px", borderRadius: "50%",
                        background: formSubjectColor || "#e5e7eb",
                        border: "2px solid #d1d5db", flexShrink: 0,
                      }} />
                      {/* Palette dots */}
                      {CONTROLLED_PALETTE.map(hex => (
                        <button
                          key={hex}
                          title={hex}
                          onClick={() => setFormSubjectColor(hex)}
                          style={{
                            width: "22px", height: "22px", borderRadius: "50%", background: hex,
                            border: formSubjectColor === hex ? "3px solid #111" : "2px solid transparent",
                            cursor: "pointer", padding: 0, flexShrink: 0,
                          }}
                        />
                      ))}
                      {/* Custom hex input */}
                      <input
                        type="text"
                        placeholder="#hex"
                        value={formSubjectColor}
                        onChange={e => setFormSubjectColor(e.target.value)}
                        style={{ ...inputStyle, width: "90px", padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                      />
                      {formSubjectColor && (
                        <button
                          onClick={() => setFormSubjectColor("")}
                          title="Clear color"
                          style={{ fontSize: "0.75rem", color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}
                        >✕</button>
                      )}
                    </div>
                    {!formSubjectColor && (
                      <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: "0.25rem 0 0" }}>
                        Leave blank to auto-assign a color from the palette.
                      </p>
                    )}
                  </div>

                  <div style={{ marginTop: "0.75rem" }}>
                    <label style={labelStyle}>Also available under</label>
                    <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: "0 0 0.5rem" }}>
                      Select additional categories where this subject should appear.
                    </p>
                    {secondaryCategoryOptions.length === 0 ? (
                      <p style={{ fontSize: "0.8125rem", color: "#9ca3af" }}>No other categories yet.</p>
                    ) : (
                      <div style={{ border: "1px solid #e5e7eb", borderRadius: "4px", maxHeight: "160px", overflowY: "auto" }}>
                        {secondaryCategoryOptions.map(cat => (
                          <label
                            key={cat.id}
                            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem 0.625rem", cursor: "pointer", fontSize: "0.875rem", borderBottom: "1px solid #f3f4f6" }}
                          >
                            <input
                              type="checkbox"
                              checked={formSecondaryCategoryIds.includes(cat.id)}
                              onChange={() => toggleSecondaryCategory(cat.id)}
                            />
                            {cat.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <button onClick={handleSave} disabled={formSaving} style={{ ...btnStyle, backgroundColor: "#059669" }}>
                  {formSaving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => { setFormMode("idle"); setFormError(""); }} style={{ ...btnStyle, backgroundColor: "#6b7280" }}>
                  Cancel
                </button>
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

function TreeNode({
  level, id, name, subjectColor, isShared, sharedFrom, expanded, selected,
  toggleExpand, handleSelect, parentId, indent = 0, children,
}: {
  level: TaxonomyLevel;
  id: string;
  name: string;
  subjectColor?: string | null;
  isShared?: boolean;
  sharedFrom?: string;
  expanded: Set<string>;
  selected: TaxNode | null;
  toggleExpand: (id: string) => void;
  handleSelect: (level: TaxonomyLevel, id: string, name: string, parentId?: string, extra?: Partial<TaxNode>) => void;
  parentId?: string;
  indent?: number;
  children?: React.ReactNode;
}) {
  const isExpandable = level !== "subtopic";
  const isExpanded = expanded.has(id);
  const isSelected = selected?.id === id && selected?.parentId === parentId;

  const accentDot = level === "subject" && subjectColor
    ? subjectColor
    : LEVEL_COLORS[level];

  return (
    <div>
      <div
        onClick={() => handleSelect(level, id, name, parentId, { subjectColor, isShared, ownerCategoryName: sharedFrom })}
        style={{
          display: "flex", alignItems: "center", gap: "0.375rem",
          padding: "0.375rem 0.5rem",
          paddingLeft: `${indent * 1.25 + 0.5}rem`,
          cursor: "pointer", borderRadius: "4px", fontSize: "0.875rem",
          backgroundColor: isSelected ? "#eff6ff" : "transparent",
          borderLeft: isSelected ? "3px solid #3b82f6" : "3px solid transparent",
        }}
      >
        {isExpandable ? (
          <span
            onClick={e => { e.stopPropagation(); toggleExpand(id); }}
            style={{ cursor: "pointer", fontSize: "0.75rem", width: "1rem", textAlign: "center", color: "#666", userSelect: "none" }}
          >
            {isExpanded ? "▼" : "▶"}
          </span>
        ) : (
          <span style={{ width: "1rem" }} />
        )}
        <span style={{
          display: "inline-block", width: "0.5rem", height: "0.5rem", borderRadius: "50%",
          backgroundColor: accentDot, flexShrink: 0,
        }} />
        <span style={{ fontWeight: isSelected ? 600 : 400, color: "#1e293b" }}>{name}</span>
        <span style={{ fontSize: "0.6875rem", color: "#94a3b8", marginLeft: "auto" }}>{LEVEL_LABELS[level]}</span>
        {isShared && (
          <span style={{
            fontSize: "0.6rem", color: "#7c3aed", background: "#ede9fe",
            borderRadius: "3px", padding: "1px 4px", fontWeight: 700, whiteSpace: "nowrap",
          }}>
            Shared{sharedFrom ? ` · ${sharedFrom}` : ""}
          </span>
        )}
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
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem", color: "#333",
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
