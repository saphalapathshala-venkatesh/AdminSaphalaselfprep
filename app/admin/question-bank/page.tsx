"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { stripHtml, hasVisibleText } from "@/lib/htmlUtils";

const RichEditor = dynamic(() => import("@/components/ui/RichEditor"), { ssr: false });
const RichContent = dynamic(() => import("@/components/ui/RichContent"), { ssr: false });

const Q_TYPES = [
  { value: "MCQ_SINGLE", label: "MCQ (Single)" },
  { value: "MCQ_MULTIPLE", label: "MCQ (Multiple)" },
  { value: "DRAG_REORDER", label: "Drag & Reorder" },
  { value: "DRAG_DROP", label: "Drag & Drop" },
  { value: "FILL_BLANKS", label: "Fill in Blanks" },
  { value: "TRUE_FALSE", label: "True / False" },
];
const DIFFICULTIES = [
  { value: "FOUNDATIONAL", label: "Foundational" },
  { value: "PROFICIENT", label: "Proficient" },
  { value: "MASTERY", label: "Mastery" },
];
const STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "APPROVED", label: "Approved" },
];
const MCQ_TYPES = ["MCQ_SINGLE", "MCQ_MULTIPLE"];

interface Option {
  text: string;
  textSecondary?: string;
  isCorrect: boolean;
}

interface GroupChild {
  type: string;
  difficulty: string;
  status: string;
  stem: string;
  stemSecondary: string;
  explanation: string;
  explanationSecondary: string;
  options: { text: string; textSecondary: string; isCorrect: boolean }[];
}

interface Question {
  id: string;
  type: string;
  difficulty: string;
  status: string;
  stem: string;
  stemSecondary?: string | null;
  explanation: string | null;
  explanationSecondary?: string | null;
  tags: string[];
  categoryId: string | null;
  subjectId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  groupId?: string | null;
  group?: { id: string; paragraph: string } | null;
  options: { id: string; text: string; textSecondary?: string | null; isCorrect: boolean; order: number }[];
  subtopic?: {
    id: string;
    name: string;
    topic: {
      id: string;
      name: string;
      subject: {
        id: string;
        name: string;
        category: { id: string; name: string };
      };
    };
  } | null;
  createdAt: string;
  // Enriched by the API when subtopicId is null but partial taxonomy IDs are set
  _categoryName?: string | null;
  _subjectName?: string | null;
  _topicName?: string | null;
}

interface TaxItem {
  id: string;
  name: string;
}

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterTopicId, setFilterTopicId] = useState("");
  const [filterSubtopicId, setFilterSubtopicId] = useState("");
  const [filterSourceTag, setFilterSourceTag] = useState("");
  const [search, setSearch] = useState("");

  const [categories, setCategories] = useState<TaxItem[]>([]);
  const [subjects, setSubjects] = useState<TaxItem[]>([]);
  const [topics, setTopics] = useState<TaxItem[]>([]);
  const [subtopics, setSubtopics] = useState<TaxItem[]>([]);

  const [formCategories, setFormCategories] = useState<TaxItem[]>([]);
  const [formSubjects, setFormSubjects] = useState<TaxItem[]>([]);
  const [formTopics, setFormTopics] = useState<TaxItem[]>([]);
  const [formSubtopics, setFormSubtopics] = useState<TaxItem[]>([]);

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [formType, setFormType] = useState("MCQ_SINGLE");
  const [formDifficulty, setFormDifficulty] = useState("FOUNDATIONAL");
  const [formStatus, setFormStatus] = useState("DRAFT");
  const [formStem, setFormStem] = useState("");
  const [formStemSecondary, setFormStemSecondary] = useState("");
  const [formExplanation, setFormExplanation] = useState("");
  const [formExplanationSecondary, setFormExplanationSecondary] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formTopicId, setFormTopicId] = useState("");
  const [formSubtopicId, setFormSubtopicId] = useState("");
  const [formOptions, setFormOptions] = useState<Option[]>([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ]);
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const [nearDupWarning, setNearDupWarning] = useState<{
    matches: { id: string; stem: string; similarity: number }[];
  } | null>(null);
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  // Group/paragraph question mode (create only; edit stays single)
  const [questionMode, setQuestionMode] = useState<"single" | "group">("single");
  const [groupParagraph, setGroupParagraph] = useState("");
  const [groupParagraphSecondary, setGroupParagraphSecondary] = useState("");
  const [groupChildren, setGroupChildren] = useState<GroupChild[]>([
    { type: "MCQ_SINGLE", difficulty: "FOUNDATIONAL", status: "DRAFT", stem: "", stemSecondary: "", explanation: "", explanationSecondary: "", options: [{ text: "", textSecondary: "", isCorrect: true }, { text: "", textSecondary: "", isCorrect: false }] },
    { type: "MCQ_SINGLE", difficulty: "FOUNDATIONAL", status: "DRAFT", stem: "", stemSecondary: "", explanation: "", explanationSecondary: "", options: [{ text: "", textSecondary: "", isCorrect: true }, { text: "", textSecondary: "", isCorrect: false }] },
  ]);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkField, setBulkField] = useState("status");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkSubjectId, setBulkSubjectId] = useState("");
  const [bulkTopicId, setBulkTopicId] = useState("");
  const [bulkSubtopicId, setBulkSubtopicId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const [bulkCategories, setBulkCategories] = useState<TaxItem[]>([]);
  const [bulkSubjects, setBulkSubjects] = useState<TaxItem[]>([]);
  const [bulkTopics, setBulkTopics] = useState<TaxItem[]>([]);
  const [bulkSubtopics, setBulkSubtopics] = useState<TaxItem[]>([]);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; stem: string } | null>(null);
  const [deleteUsageWarning, setDeleteUsageWarning] = useState<{ id: string; stem: string; usageCount: number; message: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadTax(level: string, parentId?: string): Promise<TaxItem[]> {
    const params = new URLSearchParams({ level });
    if (parentId) params.set("parentId", parentId);
    const res = await fetch(`/api/taxonomy?${params}`);
    const d = await res.json();
    return (d.data || []).map((i: any) => ({ id: i.id, name: i.name }));
  }

  useEffect(() => {
    loadTax("category").then(setCategories);
    loadTax("category").then(setFormCategories);
  }, []);

  useEffect(() => {
    if (filterCategoryId) {
      loadTax("subject", filterCategoryId).then(setSubjects);
    } else {
      setSubjects([]);
    }
    setFilterSubjectId("");
    setFilterTopicId("");
    setFilterSubtopicId("");
  }, [filterCategoryId]);

  useEffect(() => {
    if (filterSubjectId) {
      loadTax("topic", filterSubjectId).then(setTopics);
    } else {
      setTopics([]);
    }
    setFilterTopicId("");
    setFilterSubtopicId("");
  }, [filterSubjectId]);

  useEffect(() => {
    if (filterTopicId) {
      loadTax("subtopic", filterTopicId).then(setSubtopics);
    } else {
      setSubtopics([]);
    }
    setFilterSubtopicId("");
  }, [filterTopicId]);

  useEffect(() => {
    if (formCategoryId) {
      loadTax("subject", formCategoryId).then(setFormSubjects);
    } else {
      setFormSubjects([]);
    }
    setFormSubjectId("");
    setFormTopicId("");
    setFormSubtopicId("");
  }, [formCategoryId]);

  useEffect(() => {
    if (formSubjectId) {
      loadTax("topic", formSubjectId).then(setFormTopics);
    } else {
      setFormTopics([]);
    }
    setFormTopicId("");
    setFormSubtopicId("");
  }, [formSubjectId]);

  useEffect(() => {
    if (formTopicId) {
      loadTax("subtopic", formTopicId).then(setFormSubtopics);
    } else {
      setFormSubtopics([]);
    }
    setFormSubtopicId("");
  }, [formTopicId]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (filterType) params.set("type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    if (filterDifficulty) params.set("difficulty", filterDifficulty);
    if (filterCategoryId) params.set("categoryId", filterCategoryId);
    if (filterSubjectId) params.set("subjectId", filterSubjectId);
    if (filterTopicId) params.set("topicId", filterTopicId);
    if (filterSubtopicId) params.set("subtopicId", filterSubtopicId);
    if (filterSourceTag) params.set("sourceTag", filterSourceTag);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/questions?${params}`);
      const d = await res.json();
      setQuestions(d.data || []);
      setTotalPages(d.pagination?.totalPages || 1);
      setTotal(d.pagination?.total || 0);
    } catch {
      showToast("Failed to load questions", "error");
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterStatus, filterDifficulty, filterCategoryId, filterSubjectId, filterTopicId, filterSubtopicId, filterSourceTag, search]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  function resetForm() {
    setFormType("MCQ_SINGLE");
    setFormDifficulty("FOUNDATIONAL");
    setFormStatus("DRAFT");
    setFormStem("");
    setFormStemSecondary("");
    setFormExplanation("");
    setFormExplanationSecondary("");
    setFormTags("");
    setFormCategoryId("");
    setFormSubjectId("");
    setFormTopicId("");
    setFormSubtopicId("");
    setFormOptions([
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ]);
    setFormError("");
    setEditId(null);
    setNearDupWarning(null);
    setPendingPayload(null);
    // Group form reset
    setQuestionMode("single");
    setGroupParagraph("");
    setGroupParagraphSecondary("");
    setGroupChildren([
      { type: "MCQ_SINGLE", difficulty: "FOUNDATIONAL", status: "DRAFT", stem: "", stemSecondary: "", explanation: "", explanationSecondary: "", options: [{ text: "", textSecondary: "", isCorrect: true }, { text: "", textSecondary: "", isCorrect: false }] },
      { type: "MCQ_SINGLE", difficulty: "FOUNDATIONAL", status: "DRAFT", stem: "", stemSecondary: "", explanation: "", explanationSecondary: "", options: [{ text: "", textSecondary: "", isCorrect: true }, { text: "", textSecondary: "", isCorrect: false }] },
    ]);
    setGroupError("");
  }

  function startCreate() {
    resetForm();
    setMode("create");
  }

  function startEdit(q: Question) {
    setEditId(q.id);
    setFormType(q.type);
    setFormDifficulty(q.difficulty);
    setFormStatus(q.status);
    setFormStem(q.stem);
    setFormStemSecondary(q.stemSecondary || "");
    setFormExplanation(q.explanation || "");
    setFormExplanationSecondary(q.explanationSecondary || "");
    setFormTags(q.tags.join(", "));
    setFormError("");
    setNearDupWarning(null);
    setPendingPayload(null);

    if (q.subtopic) {
      const cat = q.subtopic.topic.subject.category;
      const sub = q.subtopic.topic.subject;
      const top = q.subtopic.topic;
      setFormCategoryId(cat.id);
      loadTax("subject", cat.id).then((s) => {
        setFormSubjects(s);
        setFormSubjectId(sub.id);
        loadTax("topic", sub.id).then((t) => {
          setFormTopics(t);
          setFormTopicId(top.id);
          loadTax("subtopic", top.id).then((st) => {
            setFormSubtopics(st);
            setFormSubtopicId(q.subtopicId || "");
          });
        });
      });
    } else if (q.categoryId) {
      // No full subtopic relation, but the question may have category/subject/topic IDs.
      // Set them via cascading loads so each child dropdown has its options before the
      // value is applied — matching the same pattern as Branch 1 above.
      setFormCategoryId(q.categoryId);
      loadTax("subject", q.categoryId).then((subjects) => {
        setFormSubjects(subjects);
        if (q.subjectId) {
          setFormSubjectId(q.subjectId);
          loadTax("topic", q.subjectId).then((topics) => {
            setFormTopics(topics);
            if (q.topicId) {
              setFormTopicId(q.topicId);
            }
          });
        }
      });
    }

    if (MCQ_TYPES.includes(q.type) && q.options.length > 0) {
      setFormOptions(
        q.options.map((o) => ({ text: o.text, textSecondary: o.textSecondary || "", isCorrect: o.isCorrect }))
      );
    } else {
      setFormOptions([
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
      ]);
    }
    setMode("edit");
  }

  function updateGroupChild(index: number, updates: Partial<GroupChild>) {
    setGroupChildren((prev) => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  }

  function updateGroupChildOption(childIdx: number, optIdx: number, field: "text" | "textSecondary" | "isCorrect", value: any) {
    setGroupChildren((prev) =>
      prev.map((c, i) => {
        if (i !== childIdx) return c;
        const updatedOptions = c.options.map((o, j) => {
          if (j !== optIdx) {
            if (field === "isCorrect" && value === true && c.type === "MCQ_SINGLE") {
              return { ...o, isCorrect: false };
            }
            return o;
          }
          return { ...o, [field]: value };
        });
        return { ...c, options: updatedOptions };
      })
    );
  }

  function addGroupChild() {
    if (groupChildren.length >= 10) return;
    setGroupChildren((prev) => [
      ...prev,
      { type: "MCQ_SINGLE", difficulty: "FOUNDATIONAL", status: "DRAFT", stem: "", stemSecondary: "", explanation: "", explanationSecondary: "", options: [{ text: "", textSecondary: "", isCorrect: true }, { text: "", textSecondary: "", isCorrect: false }] },
    ]);
  }

  function removeGroupChild(index: number) {
    if (groupChildren.length <= 2) return;
    setGroupChildren((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveGroup() {
    if (!hasVisibleText(groupParagraph)) {
      setGroupError("Paragraph/passage is required for the group");
      return;
    }
    for (let i = 0; i < groupChildren.length; i++) {
      const c = groupChildren[i];
      if (!hasVisibleText(c.stem)) {
        setGroupError(`Child question ${i + 1}: stem is required`);
        return;
      }
      if (MCQ_TYPES.includes(c.type)) {
        if (c.options.length < 2) { setGroupError(`Child ${i + 1}: at least 2 options required`); return; }
        if (c.options.every((o) => !o.isCorrect)) { setGroupError(`Child ${i + 1}: mark at least one option correct`); return; }
        if (c.options.some((o) => !o.text.trim())) { setGroupError(`Child ${i + 1}: all option texts are required`); return; }
      }
    }
    setGroupSaving(true);
    setGroupError("");
    try {
      const res = await fetch("/api/questions/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paragraph: groupParagraph,
          paragraphSecondary: groupParagraphSecondary.trim() || null,
          categoryId: formCategoryId || null,
          subjectId: formSubjectId || null,
          topicId: formTopicId || null,
          subtopicId: formSubtopicId || null,
          children: groupChildren.map((c) => ({
            type: c.type,
            difficulty: c.difficulty,
            status: c.status,
            stem: c.stem,
            stemSecondary: c.stemSecondary.trim() || null,
            explanation: c.explanation || null,
            explanationSecondary: c.explanationSecondary.trim() || null,
            options: MCQ_TYPES.includes(c.type)
              ? c.options.map((o) => ({ text: o.text, textSecondary: o.textSecondary.trim() || null, isCorrect: o.isCorrect }))
              : [],
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGroupError(data.error || "Failed to save group");
        return;
      }
      showToast(`Paragraph group created with ${groupChildren.length} questions`, "success");
      setMode("list");
      resetForm();
      fetchQuestions();
    } catch {
      setGroupError("Network error. Please try again.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function handleSave(confirmNearDup = false) {
    if (!hasVisibleText(formStem)) {
      setFormError("Question stem is required");
      return;
    }
    const isMCQ = MCQ_TYPES.includes(formType);
    if (isMCQ) {
      if (formOptions.length < 2) {
        setFormError("At least 2 options required");
        return;
      }
      if (formOptions.some((o) => !hasVisibleText(o.text))) {
        setFormError("All options must have text");
        return;
      }
    }

    setFormSaving(true);
    setFormError("");

    const payload: any = {
      type: formType,
      difficulty: formDifficulty,
      status: formStatus,
      stem: formStem,
      stemSecondary: formStemSecondary.trim() || null,
      explanation: hasVisibleText(formExplanation) ? formExplanation : null,
      explanationSecondary: formExplanationSecondary.trim() || null,
      tags: formTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      categoryId: formCategoryId || null,
      subjectId: formSubjectId || null,
      topicId: formTopicId || null,
      subtopicId: formSubtopicId || null,
      confirmNearDuplicate: confirmNearDup,
    };

    if (isMCQ) {
      payload.options = formOptions.map((o) => ({
        text: o.text.trim(),
        textSecondary: o.textSecondary?.trim() || null,
        isCorrect: o.isCorrect,
      }));
    }

    try {
      let res: Response;
      if (mode === "create") {
        res = await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/questions/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();

      if (data.warning && data.matches) {
        setNearDupWarning({ matches: data.matches });
        setPendingPayload(payload);
        setFormSaving(false);
        return;
      }

      if (!res.ok) {
        setFormError(data.error || "Save failed");
        setFormSaving(false);
        return;
      }

      showToast(
        mode === "create" ? "Question created" : "Question updated",
        "success"
      );
      setMode("list");
      resetForm();
      fetchQuestions();
    } catch {
      setFormError("Something went wrong");
    } finally {
      setFormSaving(false);
    }
  }

  async function confirmNearDuplicate() {
    setNearDupWarning(null);
    await handleSave(true);
  }

  async function handleDelete(force = false) {
    const target = deleteConfirm || (deleteUsageWarning ? { id: deleteUsageWarning.id, stem: deleteUsageWarning.stem } : null);
    if (!target) return;
    try {
      const url = `/api/questions/${target.id}${force ? "?force=true" : ""}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();

      if (data.warning && !force) {
        setDeleteConfirm(null);
        setDeleteUsageWarning({ id: target.id, stem: target.stem, usageCount: data.usageCount, message: data.message });
        return;
      }

      if (!res.ok) {
        showToast(data.error || "Delete failed", "error");
        return;
      }
      showToast("Question deleted from Question Bank", "success");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
      fetchQuestions();
    } catch {
      showToast("Delete failed", "error");
    } finally {
      setDeleteConfirm(null);
      setDeleteUsageWarning(null);
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    let deleted = 0, failed = 0;
    for (const id of Array.from(selected)) {
      try {
        const res = await fetch(`/api/questions/${id}?force=true`, { method: "DELETE" });
        if (res.ok) deleted++;
        else failed++;
      } catch { failed++; }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelected(new Set());
    showToast(`${deleted} deleted${failed > 0 ? `, ${failed} failed` : ""}`, deleted > 0 ? "success" : "error");
    fetchQuestions();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === questions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(questions.map((q) => q.id)));
    }
  }

  function openBulkEdit() {
    setBulkField("status");
    setBulkValue("");
    setBulkCategoryId("");
    setBulkSubjectId("");
    setBulkTopicId("");
    setBulkSubtopicId("");
    setBulkOpen(true);
    loadTax("category").then(setBulkCategories);
  }

  useEffect(() => {
    if (bulkCategoryId) {
      loadTax("subject", bulkCategoryId).then(setBulkSubjects);
    } else {
      setBulkSubjects([]);
    }
    setBulkSubjectId("");
    setBulkTopicId("");
    setBulkSubtopicId("");
  }, [bulkCategoryId]);

  useEffect(() => {
    if (bulkSubjectId) {
      loadTax("topic", bulkSubjectId).then(setBulkTopics);
    } else {
      setBulkTopics([]);
    }
    setBulkTopicId("");
    setBulkSubtopicId("");
  }, [bulkSubjectId]);

  useEffect(() => {
    if (bulkTopicId) {
      loadTax("subtopic", bulkTopicId).then(setBulkSubtopics);
    } else {
      setBulkSubtopics([]);
    }
    setBulkSubtopicId("");
  }, [bulkTopicId]);

  async function handleBulkSave() {
    setBulkSaving(true);
    const updates: any = {};

    if (bulkField === "status" && bulkValue) {
      updates.status = bulkValue;
    } else if (bulkField === "difficulty" && bulkValue) {
      updates.difficulty = bulkValue;
    } else if (bulkField === "tags" && bulkValue) {
      updates.tags = bulkValue
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      updates.tagsMode = "replace";
    } else if (bulkField === "taxonomy") {
      if (bulkCategoryId) updates.categoryId = bulkCategoryId;
      if (bulkSubjectId) updates.subjectId = bulkSubjectId;
      if (bulkTopicId) updates.topicId = bulkTopicId;
      if (bulkSubtopicId) updates.subtopicId = bulkSubtopicId;
    }

    if (Object.keys(updates).length === 0) {
      setBulkSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/questions/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), updates }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Bulk update failed", "error");
        return;
      }
      showToast(`${data.updatedCount} questions updated`, "success");
      setBulkOpen(false);
      setSelected(new Set());
      fetchQuestions();
    } catch {
      showToast("Bulk update failed", "error");
    } finally {
      setBulkSaving(false);
    }
  }

  function addOption() {
    if (formOptions.length >= 8) return;
    setFormOptions([...formOptions, { text: "", isCorrect: false }]);
  }

  function removeOption(index: number) {
    if (formOptions.length <= 2) return;
    setFormOptions(formOptions.filter((_, i) => i !== index));
  }

  function updateOption(index: number, field: "text" | "textSecondary" | "isCorrect", value: any) {
    setFormOptions(
      formOptions.map((o, i) => {
        if (i !== index) {
          if (field === "isCorrect" && formType === "MCQ_SINGLE" && value === true) {
            return { ...o, isCorrect: false };
          }
          return o;
        }
        return { ...o, [field]: value };
      })
    );
  }

  function getTypeLabel(v: string) {
    return Q_TYPES.find((t) => t.value === v)?.label || v;
  }

  function getDiffLabel(v: string) {
    return DIFFICULTIES.find((d) => d.value === v)?.label || v;
  }

  function getTaxLabel(q: Question) {
    if (q.subtopic) {
      const s = q.subtopic;
      return `${s.topic.subject.category.name} > ${s.topic.subject.name} > ${s.topic.name} > ${s.name}`;
    }
    // Fallback: use enriched names sent by API for questions with partial taxonomy
    const parts = [q._categoryName, q._subjectName, q._topicName].filter(Boolean);
    return parts.length > 0 ? parts.join(" > ") : "-";
  }

  if (mode === "create" || mode === "edit") {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "900px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", margin: 0 }}>
            {mode === "create" ? "New Question" : "Edit Question"}
          </h1>
          <button
            onClick={() => { setMode("list"); resetForm(); }}
            style={{ ...btnStyle, backgroundColor: "#6b7280" }}
          >
            Back to List
          </button>
        </div>

        {/* Mode selector — only in create mode */}
        {mode === "create" && (
          <div style={{ display: "flex", gap: "0", marginBottom: "1.25rem", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", maxWidth: "340px" }}>
            {(["single", "group"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setQuestionMode(m)}
                style={{
                  flex: 1,
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  fontWeight: questionMode === m ? 700 : 400,
                  background: questionMode === m ? "#7c3aed" : "#f8fafc",
                  color: questionMode === m ? "#fff" : "#64748b",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                  transition: "all 0.15s",
                }}
              >
                {m === "single" ? "Single Question" : "Paragraph Group"}
              </button>
            ))}
          </div>
        )}

        {/* ── GROUP FORM ──────────────────────────────────────────────────── */}
        {mode === "create" && questionMode === "group" && (
          <div>
            {groupError && <div style={errorBox}>{groupError}</div>}

            {/* Passage / paragraph */}
            <div style={{ ...cardStyle, marginBottom: "1rem" }}>
              <div style={{ fontWeight: 700, color: "#7c3aed", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
                Passage / Paragraph
              </div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.5rem" }}>
                This text appears above all child questions. Include the reading passage, figure description, or case study here.
              </div>
              <RichEditor
                value={groupParagraph}
                onChange={setGroupParagraph}
                placeholder="Type or paste the paragraph/passage here…"
                minHeight={100}
              />
            </div>
            <div style={{ ...cardStyle, marginBottom: "1rem", borderLeft: "3px solid #059669" }}>
              <label style={{ ...labelStyle, color: "#059669" }}>
                Passage — Secondary Language
                <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.72rem", marginLeft: "0.5rem" }}>(optional — e.g. Telugu, Hindi)</span>
              </label>
              <div style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: "0.5rem" }}>
                Secondary language translation of the passage shown above all child questions.
              </div>
              <RichEditor
                value={groupParagraphSecondary}
                onChange={setGroupParagraphSecondary}
                placeholder="Secondary language translation of the passage…"
                minHeight={80}
              />
            </div>

            {/* Shared taxonomy */}
            <div style={{ ...cardStyle, marginBottom: "1rem" }}>
              <div style={{ fontWeight: 700, color: "#374151", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
                Taxonomy (shared by all child questions)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)} style={selectStyle}>
                    <option value="">-- Select --</option>
                    {formCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Subject</label>
                  <select value={formSubjectId} onChange={(e) => setFormSubjectId(e.target.value)} style={selectStyle} disabled={!formCategoryId}>
                    <option value="">-- Select --</option>
                    {formSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Topic</label>
                  <select value={formTopicId} onChange={(e) => setFormTopicId(e.target.value)} style={selectStyle} disabled={!formSubjectId}>
                    <option value="">-- Select --</option>
                    {formTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Subtopic</label>
                  <select value={formSubtopicId} onChange={(e) => setFormSubtopicId(e.target.value)} style={selectStyle} disabled={!formTopicId}>
                    <option value="">-- Select --</option>
                    {formSubtopics.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Child questions */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div style={{ fontWeight: 700, color: "#374151", fontSize: "0.9rem" }}>
                  Child Questions ({groupChildren.length}/10)
                </div>
                <button
                  type="button"
                  onClick={addGroupChild}
                  disabled={groupChildren.length >= 10}
                  style={{ ...btnStyle, fontSize: "0.8rem", padding: "0.3rem 0.7rem", backgroundColor: groupChildren.length >= 10 ? "#94a3b8" : "#7c3aed" }}
                >
                  + Add Question
                </button>
              </div>

              {groupChildren.map((child, ci) => (
                <div key={ci} style={{ ...cardStyle, marginBottom: "0.875rem", border: "1px solid #c4b5fd", position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <span style={{ fontWeight: 700, color: "#7c3aed", fontSize: "0.85rem" }}>
                      Question {ci + 1}
                    </span>
                    {groupChildren.length > 2 && (
                      <button type="button" onClick={() => removeGroupChild(ci)} style={{ ...btnStyle, fontSize: "0.75rem", padding: "0.2rem 0.5rem", backgroundColor: "#dc2626" }}>
                        Remove
                      </button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select
                        value={child.type}
                        onChange={(e) => {
                          const t = e.target.value;
                          const newOptions: { text: string; textSecondary: string; isCorrect: boolean }[] = MCQ_TYPES.includes(t)
                            ? (child.options.length >= 2 ? child.options : [{ text: "", textSecondary: "", isCorrect: true }, { text: "", textSecondary: "", isCorrect: false }])
                            : [];
                          updateGroupChild(ci, { type: t, options: newOptions });
                        }}
                        style={selectStyle}
                      >
                        {Q_TYPES.map((qt) => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Difficulty</label>
                      <select value={child.difficulty} onChange={(e) => updateGroupChild(ci, { difficulty: e.target.value })} style={selectStyle}>
                        {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select value={child.status} onChange={(e) => updateGroupChild(ci, { status: e.target.value })} style={selectStyle}>
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: "0.5rem" }}>
                    <label style={labelStyle}>Question Stem — Primary Language *</label>
                    <RichEditor value={child.stem} onChange={(html) => updateGroupChild(ci, { stem: html })} placeholder="Question text…" minHeight={60} />
                  </div>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label style={{ ...labelStyle, color: "#059669" }}>
                      Question Stem — Secondary Language
                      <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.72rem", marginLeft: "0.5rem" }}>(optional — e.g. Telugu, Hindi)</span>
                    </label>
                    <RichEditor value={child.stemSecondary} onChange={(html) => updateGroupChild(ci, { stemSecondary: html })} placeholder="Secondary language translation of the question stem…" minHeight={44} />
                  </div>

                  {MCQ_TYPES.includes(child.type) && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                        <label style={labelStyle}>Options</label>
                        {child.options.length < 8 && (
                          <button type="button" onClick={() => updateGroupChild(ci, { options: [...child.options, { text: "", textSecondary: "", isCorrect: false }] })}
                            style={{ ...btnStyle, fontSize: "0.7rem", padding: "0.15rem 0.4rem", backgroundColor: "#7c3aed" }}>
                            + Option
                          </button>
                        )}
                      </div>
                      {child.options.map((opt, oi) => (
                        <div key={oi} style={{ display: "flex", gap: "0.375rem", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                          <div style={{ paddingTop: "0.45rem" }}>
                            <input
                              type={child.type === "MCQ_SINGLE" ? "radio" : "checkbox"}
                              checked={opt.isCorrect}
                              onChange={() => updateGroupChildOption(ci, oi, "isCorrect", child.type === "MCQ_SINGLE" ? true : !opt.isCorrect)}
                              style={{ accentColor: "#059669" }}
                            />
                          </div>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                            <input
                              value={opt.text}
                              onChange={(e) => updateGroupChildOption(ci, oi, "text", e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + oi)} — Primary Language`}
                              style={{ ...inputStyle, padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
                            />
                            <input
                              value={opt.textSecondary}
                              onChange={(e) => updateGroupChildOption(ci, oi, "textSecondary", e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + oi)} — Secondary Language (optional)`}
                              style={{ ...inputStyle, padding: "0.22rem 0.5rem", fontSize: "0.8rem", color: "#059669", borderColor: "#a7f3d0" }}
                            />
                          </div>
                          {child.options.length > 2 && (
                            <div style={{ paddingTop: "0.3rem" }}>
                              <button type="button" onClick={() => updateGroupChild(ci, { options: child.options.filter((_, j) => j !== oi) })}
                                style={{ ...btnStyle, fontSize: "0.7rem", padding: "0.15rem 0.4rem", backgroundColor: "#dc2626" }}>×</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginBottom: "0.5rem" }}>
                    <label style={labelStyle}>Explanation — Primary Language (optional)</label>
                    <RichEditor value={child.explanation} onChange={(html) => updateGroupChild(ci, { explanation: html })} placeholder="Explain the correct answer…" minHeight={44} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: "#059669" }}>
                      Explanation — Secondary Language
                      <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.72rem", marginLeft: "0.5rem" }}>(optional)</span>
                    </label>
                    <RichEditor value={child.explanationSecondary} onChange={(html) => updateGroupChild(ci, { explanationSecondary: html })} placeholder="Secondary language translation of the explanation…" minHeight={44} />
                  </div>
                </div>
              ))}
            </div>

            {/* Save group */}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                onClick={handleSaveGroup}
                disabled={groupSaving}
                style={{ ...btnStyle, backgroundColor: "#7c3aed" }}
              >
                {groupSaving ? "Saving…" : `Save Group (${groupChildren.length} questions)`}
              </button>
              <button
                type="button"
                onClick={() => { setMode("list"); resetForm(); }}
                style={{ ...btnStyle, backgroundColor: "#6b7280" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── SINGLE QUESTION FORM (hidden when group mode active in create) ──── */}
        {questionMode === "single" && (
          <>

        {formError && (
          <div style={errorBox}>{formError}</div>
        )}

        {nearDupWarning && (
          <div style={{ ...errorBox, backgroundColor: "#fffbeb", borderColor: "#fbbf24", color: "#92400e" }}>
            <strong>Near-duplicate warning:</strong> Similar questions found in the same subtopic.
            <ul style={{ margin: "0.5rem 0", paddingLeft: "1.25rem" }}>
              {nearDupWarning.matches.map((m) => (
                <li key={m.id} style={{ marginBottom: "0.25rem" }}>
                  ({m.similarity}% similar) {stripHtml(m.stem)}
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button onClick={confirmNearDuplicate} style={{ ...btnStyle, backgroundColor: "#d97706" }}>
                Save Anyway
              </button>
              <button onClick={() => setNearDupWarning(null)} style={{ ...btnStyle, backgroundColor: "#6b7280" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={labelStyle}>Type *</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                style={selectStyle}
              >
                {Q_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Difficulty *</label>
              <select
                value={formDifficulty}
                onChange={(e) => setFormDifficulty(e.target.value)}
                style={selectStyle}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                style={selectStyle}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                style={selectStyle}
              >
                <option value="">-- Select --</option>
                {formCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Subject</label>
              <select
                value={formSubjectId}
                onChange={(e) => setFormSubjectId(e.target.value)}
                style={selectStyle}
                disabled={!formCategoryId}
              >
                <option value="">-- Select --</option>
                {formSubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Topic</label>
              <select
                value={formTopicId}
                onChange={(e) => setFormTopicId(e.target.value)}
                style={selectStyle}
                disabled={!formSubjectId}
              >
                <option value="">-- Select --</option>
                {formTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Subtopic</label>
              <select
                value={formSubtopicId}
                onChange={(e) => setFormSubtopicId(e.target.value)}
                style={selectStyle}
                disabled={!formTopicId}
              >
                <option value="">-- Select --</option>
                {formSubtopics.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Question Stem (Primary Language) *</label>
            <RichEditor
              value={formStem}
              onChange={setFormStem}
              placeholder="Type question text, paste an image/screenshot, or insert an equation…"
              minHeight={80}
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ ...labelStyle, color: "#059669" }}>Question Stem — Secondary Language <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.72rem" }}>(optional — e.g. Telugu, Hindi)</span></label>
            <RichEditor
              value={formStemSecondary}
              onChange={setFormStemSecondary}
              placeholder="Secondary language translation of the question stem…"
              minHeight={60}
            />
          </div>

          {MCQ_TYPES.includes(formType) && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={labelStyle}>
                  Options (2-8) &mdash; {formType === "MCQ_SINGLE" ? "select 1 correct" : "select 1+ correct"}
                </label>
                <button
                  onClick={addOption}
                  disabled={formOptions.length >= 8}
                  style={{
                    ...btnStyle,
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    backgroundColor: formOptions.length >= 8 ? "#cbd5e1" : "#7c3aed",
                  }}
                >
                  + Add Option
                </button>
              </div>
              {formOptions.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <div style={{ paddingTop: "2.25rem" }}>
                    <input
                      type={formType === "MCQ_SINGLE" ? "radio" : "checkbox"}
                      name="correctOption"
                      checked={opt.isCorrect}
                      onChange={() => updateOption(i, "isCorrect", formType === "MCQ_SINGLE" ? true : !opt.isCorrect)}
                      style={{ cursor: "pointer", accentColor: "#059669", width: "16px", height: "16px" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <RichEditor
                      value={opt.text}
                      onChange={(html) => updateOption(i, "text", html)}
                      placeholder={`Option ${i + 1} primary — text, image, or equation`}
                      minHeight={44}
                    />
                    <RichEditor
                      value={opt.textSecondary || ""}
                      onChange={(html) => updateOption(i, "textSecondary", html)}
                      placeholder={`Option ${i + 1} secondary language (optional)`}
                      minHeight={36}
                    />
                  </div>
                  {formOptions.length > 2 && (
                    <div style={{ paddingTop: "2.125rem" }}>
                      <button
                        onClick={() => removeOption(i)}
                        style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "1.125rem", padding: "0 0.25rem" }}
                      >
                        &times;
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Explanation (Primary Language)</label>
            <RichEditor
              value={formExplanation}
              onChange={setFormExplanation}
              placeholder="Explain the correct answer — include images or equations if needed…"
              minHeight={60}
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ ...labelStyle, color: "#059669" }}>Explanation — Secondary Language <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.72rem" }}>(optional)</span></label>
            <RichEditor
              value={formExplanationSecondary}
              onChange={setFormExplanationSecondary}
              placeholder="Secondary language translation of the explanation…"
              minHeight={50}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Tags (comma separated)</label>
            <input
              type="text"
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="e.g. kinematics, newton, neet"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => handleSave(false)}
              disabled={formSaving}
              style={{ ...btnStyle, backgroundColor: "#059669" }}
            >
              {formSaving ? "Saving..." : "Save Question"}
            </button>
            <button
              onClick={() => { setMode("list"); resetForm(); }}
              style={{ ...btnStyle, backgroundColor: "#6b7280" }}
            >
              Cancel
            </button>
          </div>
        </div>
        </>)}
      </div>
    );
  }

  const foundationalCount = questions.filter(q => q.difficulty === "FOUNDATIONAL").length;
  const proficientCount = questions.filter(q => q.difficulty === "PROFICIENT").length;
  const masteryCount = questions.filter(q => q.difficulty === "MASTERY").length;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", margin: 0 }}>
          Question Bank
        </h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {selected.size > 0 && (
            <>
              <button onClick={openBulkEdit} style={{ ...btnStyle, backgroundColor: "#7c3aed" }}>
                Bulk Edit ({selected.size})
              </button>
              <button onClick={() => setBulkDeleteConfirm(true)} style={{ ...btnStyle, backgroundColor: "#dc2626" }}>
                Delete Selected ({selected.size})
              </button>
            </>
          )}
          <button onClick={startCreate} style={btnStyle}>+ New Question</button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {[
          { label: "Total in Bank", value: total, color: "#7c3aed", bg: "#f5f3ff" },
          { label: "Showing (filtered)", value: questions.length, color: "#0369a1", bg: "#eff6ff" },
          { label: "Foundational", value: foundationalCount, color: "#1e40af", bg: "#dbeafe" },
          { label: "Proficient", value: proficientCount, color: "#92400e", bg: "#fef3c7" },
          { label: "Mastery", value: masteryCount, color: "#9d174d", bg: "#fce7f3" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${color}20`, borderRadius: "8px", padding: "0.5rem 0.875rem", minWidth: "110px" }}>
            <div style={{ fontSize: "0.6875rem", color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color, lineHeight: 1.2 }}>{value.toLocaleString()}</div>
          </div>
        ))}
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

      <div style={{ ...cardStyle, marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={filterLabelStyle}>Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Stem or tag..."
              style={{ ...inputStyle, width: "160px" }}
            />
          </div>
          <div>
            <label style={filterLabelStyle}>Type</label>
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} style={{ ...selectStyle, width: "130px" }}>
              <option value="">All</option>
              {Q_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={filterLabelStyle}>Status</label>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} style={{ ...selectStyle, width: "110px" }}>
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={filterLabelStyle}>Difficulty</label>
            <select value={filterDifficulty} onChange={(e) => { setFilterDifficulty(e.target.value); setPage(1); }} style={{ ...selectStyle, width: "130px" }}>
              <option value="">All</option>
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={filterLabelStyle}>Category</label>
            <select value={filterCategoryId} onChange={(e) => { setFilterCategoryId(e.target.value); setPage(1); }} style={{ ...selectStyle, width: "130px" }}>
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {filterCategoryId && (
            <div>
              <label style={filterLabelStyle}>Subject</label>
              <select value={filterSubjectId} onChange={(e) => { setFilterSubjectId(e.target.value); setPage(1); }} style={{ ...selectStyle, width: "130px" }}>
                <option value="">All</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          {filterSubjectId && (
            <div>
              <label style={filterLabelStyle}>Topic</label>
              <select value={filterTopicId} onChange={(e) => { setFilterTopicId(e.target.value); setPage(1); }} style={{ ...selectStyle, width: "130px" }}>
                <option value="">All</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          {filterTopicId && (
            <div>
              <label style={filterLabelStyle}>Subtopic</label>
              <select value={filterSubtopicId} onChange={(e) => { setFilterSubtopicId(e.target.value); setPage(1); }} style={{ ...selectStyle, width: "130px" }}>
                <option value="">All</option>
                {subtopics.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={filterLabelStyle}>Source Tag</label>
            <input
              type="text"
              value={filterSourceTag}
              onChange={(e) => { setFilterSourceTag(e.target.value); setPage(1); }}
              placeholder="e.g. PYQ_2023"
              style={{ ...inputStyle, width: "110px" }}
            />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              <th style={thStyle}>
                <input
                  type="checkbox"
                  checked={questions.length > 0 && selected.size === questions.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th style={thStyle}>Stem</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Difficulty</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Taxonomy</th>
              <th style={thStyle}>In Tests</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                  Loading...
                </td>
              </tr>
            ) : questions.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
                  No questions found. Create one to get started.
                </td>
              </tr>
            ) : (
              questions.map((q) => (
                <tr key={q.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={selected.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                    />
                  </td>
                  <td style={{ ...tdStyle, maxWidth: "300px" }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {stripHtml(q.stem)}
                    </span>
                    {q.tags.length > 0 && (
                      <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>
                        {q.tags.join(", ")}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {getTypeLabel(q.type)}
                    {q.groupId && (
                      <span style={{ display: "block", fontSize: "0.6rem", fontWeight: 700, color: "#7c3aed", marginTop: "1px" }}>
                        ¶ Grouped
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: "inline-block",
                      padding: "0.125rem 0.375rem",
                      borderRadius: "9999px",
                      fontSize: "0.6875rem",
                      fontWeight: 500,
                      backgroundColor:
                        q.difficulty === "FOUNDATIONAL" ? "#dbeafe" :
                        q.difficulty === "PROFICIENT" ? "#fef3c7" : "#fce7f3",
                      color:
                        q.difficulty === "FOUNDATIONAL" ? "#1e40af" :
                        q.difficulty === "PROFICIENT" ? "#92400e" : "#9d174d",
                    }}>
                      {getDiffLabel(q.difficulty)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: "inline-block",
                      padding: "0.125rem 0.375rem",
                      borderRadius: "9999px",
                      fontSize: "0.6875rem",
                      fontWeight: 500,
                      backgroundColor: q.status === "DRAFT" ? "#f1f5f9" : "#ecfdf5",
                      color: q.status === "DRAFT" ? "#475569" : "#059669",
                    }}>
                      {q.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: "200px", fontSize: "0.75rem", color: "#6b7280" }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {getTaxLabel(q)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {(q as any)._count?.testQuestions > 0 ? (
                      <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 600, background: "#fef9c3", color: "#78350f" }} title={`Used in ${(q as any)._count.testQuestions} test(s)`}>
                        {(q as any)._count.testQuestions} test{(q as any)._count.testQuestions > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button onClick={() => startEdit(q)} style={{ ...btnSmall, backgroundColor: "#7c3aed" }}>Edit</button>
                      <button onClick={() => setDeleteConfirm({ id: q.id, stem: q.stem })} style={{ ...btnSmall, backgroundColor: "#dc2626" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ ...btnSmall, backgroundColor: page <= 1 ? "#e2e8f0" : "#7c3aed", color: page <= 1 ? "#94a3b8" : "#fff" }}
            >
              Prev
            </button>
            <span style={{ fontSize: "0.8125rem", color: "#666" }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ ...btnSmall, backgroundColor: page >= totalPages ? "#e2e8f0" : "#7c3aed", color: page >= totalPages ? "#94a3b8" : "#fff" }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>Delete from Question Bank</h3>
            <p style={{ fontSize: "0.875rem", color: "#333", marginBottom: "0.5rem" }}>
              This will permanently remove the question from the Question Bank. Questions can only be deleted here, not from individual tests.
            </p>
            <p style={{ fontSize: "0.8125rem", color: "#666", marginBottom: "1rem", fontStyle: "italic", padding: "0.5rem", background: "#f8fafc", borderRadius: "4px" }}>
              &ldquo;{stripHtml(deleteConfirm.stem).substring(0, 150)}&rdquo;
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ ...btnStyle, backgroundColor: "#6b7280" }}>Cancel</button>
              <button onClick={() => handleDelete(false)} style={{ ...btnStyle, backgroundColor: "#dc2626" }}>Delete from Bank</button>
            </div>
          </div>
        </div>
      )}

      {deleteUsageWarning && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600, color: "#dc2626" }}>⚠ Question Used in Tests</h3>
            <div style={{ padding: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.875rem", color: "#991b1b", margin: "0 0 0.25rem", fontWeight: 600 }}>{deleteUsageWarning.message}</p>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "#666", marginBottom: "1rem", fontStyle: "italic", padding: "0.5rem", background: "#f8fafc", borderRadius: "4px" }}>
              &ldquo;{stripHtml(deleteUsageWarning.stem).substring(0, 150)}&rdquo;
            </p>
            <p style={{ fontSize: "0.8125rem", color: "#374151", marginBottom: "1rem" }}>
              Deleting will remove this question from the Question Bank and from all tests it is currently attached to. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteUsageWarning(null)} style={{ ...btnStyle, backgroundColor: "#6b7280" }}>Cancel</button>
              <button onClick={() => handleDelete(true)} style={{ ...btnStyle, backgroundColor: "#dc2626" }}>Force Delete Anyway</button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteConfirm && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>Bulk Delete from Question Bank</h3>
            <p style={{ fontSize: "0.875rem", color: "#333", marginBottom: "1rem" }}>
              You are about to delete <strong>{selected.size} question{selected.size > 1 ? "s" : ""}</strong> from the Question Bank. Questions used in tests will be force-deleted and removed from those tests as well.
            </p>
            <p style={{ fontSize: "0.8125rem", color: "#dc2626", marginBottom: "1rem", fontWeight: 600 }}>
              This action cannot be undone. Questions can only be deleted from the Question Bank, never from individual tests.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setBulkDeleteConfirm(false)} style={{ ...btnStyle, backgroundColor: "#6b7280" }}>Cancel</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting} style={{ ...btnStyle, backgroundColor: "#dc2626" }}>
                {bulkDeleting ? "Deleting..." : `Delete ${selected.size} Question${selected.size > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkOpen && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, maxWidth: "500px" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>
              Bulk Edit ({selected.size} questions)
            </h3>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Field to update</label>
              <select value={bulkField} onChange={(e) => setBulkField(e.target.value)} style={selectStyle}>
                <option value="status">Status</option>
                <option value="difficulty">Difficulty</option>
                <option value="tags">Tags (replace)</option>
                <option value="taxonomy">Taxonomy</option>
              </select>
            </div>

            {bulkField === "status" && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>New Status</label>
                <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} style={selectStyle}>
                  <option value="">-- Select --</option>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {bulkField === "difficulty" && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>New Difficulty</label>
                <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} style={selectStyle}>
                  <option value="">-- Select --</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            )}

            {bulkField === "tags" && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>New Tags (comma separated)</label>
                <input
                  type="text"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder="tag1, tag2"
                  style={inputStyle}
                />
              </div>
            )}

            {bulkField === "taxonomy" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)} style={selectStyle}>
                    <option value="">-- Select --</option>
                    {bulkCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Subject</label>
                  <select value={bulkSubjectId} onChange={(e) => setBulkSubjectId(e.target.value)} style={selectStyle} disabled={!bulkCategoryId}>
                    <option value="">-- Select --</option>
                    {bulkSubjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Topic</label>
                  <select value={bulkTopicId} onChange={(e) => setBulkTopicId(e.target.value)} style={selectStyle} disabled={!bulkSubjectId}>
                    <option value="">-- Select --</option>
                    {bulkTopics.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Subtopic</label>
                  <select value={bulkSubtopicId} onChange={(e) => setBulkSubtopicId(e.target.value)} style={selectStyle} disabled={!bulkTopicId}>
                    <option value="">-- Select --</option>
                    {bulkSubtopics.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setBulkOpen(false)} style={{ ...btnStyle, backgroundColor: "#6b7280" }}>Cancel</button>
              <button onClick={handleBulkSave} disabled={bulkSaving} style={{ ...btnStyle, backgroundColor: "#7c3aed" }}>
                {bulkSaving ? "Saving..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "0.375rem 0.75rem",
  backgroundColor: "#7c3aed",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  fontSize: "0.8125rem",
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const btnSmall: React.CSSProperties = {
  padding: "0.1875rem 0.5rem",
  backgroundColor: "#7c3aed",
  color: "#fff",
  border: "none",
  borderRadius: "3px",
  fontSize: "0.75rem",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.4375rem 0.625rem",
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  fontSize: "0.8125rem",
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.4375rem 0.5rem",
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  fontSize: "0.8125rem",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 500,
  marginBottom: "0.25rem",
  color: "#374151",
};

const filterLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.6875rem",
  fontWeight: 500,
  marginBottom: "0.125rem",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "1rem",
  backgroundColor: "#fff",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0.625rem",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.625rem",
  verticalAlign: "middle",
};

const errorBox: React.CSSProperties = {
  padding: "0.75rem 1rem",
  backgroundColor: "#fef2f2",
  color: "#dc2626",
  borderRadius: "6px",
  fontSize: "0.8125rem",
  marginBottom: "1rem",
  border: "1px solid #fecaca",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalBox: React.CSSProperties = {
  backgroundColor: "#fff",
  borderRadius: "8px",
  padding: "1.5rem",
  width: "100%",
  maxWidth: "420px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
};
