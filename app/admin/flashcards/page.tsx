"use client";

import { useState, useEffect, useCallback } from "react";

interface FlashcardDeck {
  xpEnabled?: boolean;
  xpValue?: number;
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  subjectId: string | null;
  topicId: string | null;
  isPublished: boolean;
  createdAt: string;
  _count?: { cards: number };
}

interface FlashcardCard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  imageUrl: string | null;
  subtopicId: string | null;
  order: number;
  subtopic?: {
    id: string;
    name: string;
    topicId: string;
    topic?: {
      id: string;
      name: string;
      subjectId: string;
      subject?: { id: string; name: string; categoryId: string };
    };
  } | null;
}

interface TaxItem {
  id: string;
  name: string;
}

export default function FlashcardsPage() {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [deckSearch, setDeckSearch] = useState("");
  const [pubFilter, setPubFilter] = useState("");
  const [deckPage, setDeckPage] = useState(1);
  const [deckTotalPages, setDeckTotalPages] = useState(1);

  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [editingDeck, setEditingDeck] = useState(false);
  const [deckForm, setDeckForm] = useState({ title: "", description: "", categoryId: "", subjectId: "", topicId: "", xpEnabled: false, xpValue: "0" });

  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardPage, setCardPage] = useState(1);
  const [cardTotalPages, setCardTotalPages] = useState(1);
  const [cardSearch, setCardSearch] = useState("");

  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashcardCard | null>(null);
  const [cardForm, setCardForm] = useState({ front: "", back: "", imageUrl: "", categoryId: "", subjectId: "", topicId: "", subtopicId: "" });

  const [showNewDeck, setShowNewDeck] = useState(false);
  const [newDeckForm, setNewDeckForm] = useState({ title: "", description: "", categoryId: "", subjectId: "", topicId: "", xpEnabled: false, xpValue: "0" });

  const [categories, setCategories] = useState<TaxItem[]>([]);
  const [subjects, setSubjects] = useState<TaxItem[]>([]);
  const [topics, setTopics] = useState<TaxItem[]>([]);
  const [subtopics, setSubtopics] = useState<TaxItem[]>([]);

  const [deckSubjects, setDeckSubjects] = useState<TaxItem[]>([]);
  const [deckTopics, setDeckTopics] = useState<TaxItem[]>([]);

  const [newDeckSubjects, setNewDeckSubjects] = useState<TaxItem[]>([]);
  const [newDeckTopics, setNewDeckTopics] = useState<TaxItem[]>([]);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);
  const [allCardsLoaded, setAllCardsLoaded] = useState(false);
  const [cardTotal, setCardTotal] = useState(0);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadTax = async (level: string, parentId?: string) => {
    const params = new URLSearchParams({ level });
    if (parentId) params.set("parentId", parentId);
    const res = await fetch(`/api/taxonomy?${params}`);
    const json = await res.json();
    return json.data || [];
  };

  useEffect(() => {
    loadTax("category").then(setCategories);
  }, []);

  const loadDecks = useCallback(async () => {
    setLoadingDecks(true);
    const params = new URLSearchParams({ page: String(deckPage), pageSize: "20" });
    if (deckSearch) params.set("search", deckSearch);
    if (pubFilter) params.set("isPublished", pubFilter);
    try {
      const res = await fetch(`/api/flashcards/decks?${params}`);
      const json = await res.json();
      setDecks(json.items || []);
      setDeckTotalPages(Math.ceil((json.total || 0) / 20));
    } catch {
      showToast("Failed to load decks", "error");
    } finally {
      setLoadingDecks(false);
    }
  }, [deckPage, deckSearch, pubFilter]);

  useEffect(() => { loadDecks(); }, [loadDecks]);

  const loadCards = useCallback(async (deckId: string) => {
    setLoadingCards(true);
    const params = new URLSearchParams({ page: String(cardPage), pageSize: "25" });
    if (cardSearch) params.set("search", cardSearch);
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/cards?${params}`);
      const json = await res.json();
      setCards(json.items || []);
      setCardTotal(json.total || 0);
      setCardTotalPages(Math.ceil((json.total || 0) / 25));
    } catch {
      showToast("Failed to load cards", "error");
    } finally {
      setLoadingCards(false);
    }
  }, [cardPage, cardSearch]);

  useEffect(() => {
    if (selectedDeck) loadCards(selectedDeck.id);
  }, [selectedDeck, loadCards]);

  const selectDeck = (d: FlashcardDeck) => {
    setSelectedDeck(d);
    setEditingDeck(false);
    setCardPage(1);
    setCardSearch("");
    setOrderChanged(false);
    setAllCardsLoaded(false);
    setDeckForm({
      title: d.title,
      description: d.description || "",
      categoryId: d.categoryId || "",
      subjectId: d.subjectId || "",
      topicId: d.topicId || "",
      xpEnabled: d.xpEnabled || false,
      xpValue: d.xpValue != null ? String(d.xpValue) : "0",
    });
    if (d.categoryId) loadTax("subject", d.categoryId).then(setDeckSubjects);
    else setDeckSubjects([]);
    if (d.subjectId) loadTax("topic", d.subjectId).then(setDeckTopics);
    else setDeckTopics([]);
  };

  const handleCreateDeck = async () => {
    if (!newDeckForm.title.trim()) { showToast("Title required", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/flashcards/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDeckForm.title,
          description: newDeckForm.description || null,
          categoryId: newDeckForm.categoryId || null,
          subjectId: newDeckForm.subjectId || null,
          topicId: newDeckForm.topicId || null,
          xpEnabled: newDeckForm.xpEnabled,
          xpValue: parseInt(newDeckForm.xpValue) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Deck created", "success");
      setShowNewDeck(false);
      setNewDeckForm({ title: "", description: "", categoryId: "", subjectId: "", topicId: "", xpEnabled: false, xpValue: "0" });
      loadDecks();
      selectDeck(json.data);
    } catch { showToast("Failed to create deck", "error"); }
    finally { setSaving(false); }
  };

  const handleUpdateDeck = async () => {
    if (!selectedDeck || !deckForm.title.trim()) { showToast("Title required", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${selectedDeck.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: deckForm.title,
          description: deckForm.description || null,
          categoryId: deckForm.categoryId || null,
          subjectId: deckForm.subjectId || null,
          topicId: deckForm.topicId || null,
          xpEnabled: deckForm.xpEnabled,
          xpValue: parseInt(deckForm.xpValue) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Deck updated", "success");
      setEditingDeck(false);
      setSelectedDeck(json.data);
      loadDecks();
    } catch { showToast("Failed to update", "error"); }
    finally { setSaving(false); }
  };

  const handleTogglePublish = async () => {
    if (!selectedDeck) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${selectedDeck.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !selectedDeck.isPublished }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      setSelectedDeck(json.data);
      showToast(json.data.isPublished ? "Published" : "Unpublished", "success");
      loadDecks();
    } catch { showToast("Failed", "error"); }
    finally { setSaving(false); }
  };

  const handleDeleteDeck = async () => {
    if (!selectedDeck) return;
    if (!confirm(`Delete deck "${selectedDeck.title}"? This will also delete all its cards.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${selectedDeck.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed to delete", "error"); return; }
      showToast("Deck deleted", "success");
      setSelectedDeck(null);
      loadDecks();
    } catch { showToast("Failed to delete", "error"); }
    finally { setSaving(false); }
  };

  const openCardEditor = (card?: FlashcardCard) => {
    if (card) {
      setEditingCard(card);
      const catId = card.subtopic?.topic?.subject?.categoryId || "";
      const subId = card.subtopic?.topic?.subjectId || "";
      const topId = card.subtopic?.topicId || "";
      setCardForm({
        front: card.front,
        back: card.back,
        imageUrl: card.imageUrl || "",
        categoryId: catId,
        subjectId: subId,
        topicId: topId,
        subtopicId: card.subtopicId || "",
      });
      if (catId) loadTax("subject", catId).then(setSubjects);
      if (subId) loadTax("topic", subId).then(setTopics);
      if (topId) loadTax("subtopic", topId).then(setSubtopics);
    } else {
      setEditingCard(null);
      setCardForm({ front: "", back: "", imageUrl: "", categoryId: "", subjectId: "", topicId: "", subtopicId: "" });
      setSubjects([]);
      setTopics([]);
      setSubtopics([]);
    }
    setShowCardModal(true);
  };

  const handleSaveCard = async () => {
    if (!selectedDeck) return;
    if (!cardForm.front.trim() || !cardForm.back.trim()) {
      showToast("Front and Back are required", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        front: cardForm.front,
        back: cardForm.back,
        imageUrl: cardForm.imageUrl || null,
        subtopicId: cardForm.subtopicId || null,
      };

      let res;
      if (editingCard) {
        res = await fetch(`/api/flashcards/cards/${editingCard.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/flashcards/decks/${selectedDeck.id}/cards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast(editingCard ? "Card updated" : "Card added", "success");
      setShowCardModal(false);
      loadCards(selectedDeck.id);
      loadDecks();
    } catch { showToast("Failed to save card", "error"); }
    finally { setSaving(false); }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!selectedDeck || !confirm("Delete this card?")) return;
    try {
      const res = await fetch(`/api/flashcards/cards/${cardId}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json(); showToast(j.error || "Failed", "error"); return; }
      showToast("Card deleted", "success");
      loadCards(selectedDeck.id);
      loadDecks();
    } catch { showToast("Failed to delete", "error"); }
  };

  const loadAllCards = async (deckId: string) => {
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/cards?pageSize=1000`);
      const json = await res.json();
      setCards(json.items || []);
      setAllCardsLoaded(true);
      return true;
    } catch {
      showToast("Failed to load all cards for reordering", "error");
      return false;
    }
  };

  const moveCard = async (index: number, direction: "up" | "down") => {
    if (!allCardsLoaded && cardTotal > 25 && selectedDeck) {
      const ok = await loadAllCards(selectedDeck.id);
      if (!ok) return;
      showToast("Loaded all cards for reordering", "success");
      return;
    }
    const newCards = [...cards];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newCards.length) return;
    [newCards[index], newCards[swapIdx]] = [newCards[swapIdx], newCards[index]];
    setCards(newCards);
    setOrderChanged(true);
  };

  const handleSaveOrder = async () => {
    if (!selectedDeck) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${selectedDeck.id}/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedCardIds: cards.map((c) => c.id) }),
      });
      if (!res.ok) { const j = await res.json(); showToast(j.error || "Failed", "error"); return; }
      showToast("Order saved", "success");
      setOrderChanged(false);
      setAllCardsLoaded(false);
      loadCards(selectedDeck.id);
    } catch { showToast("Failed to save order", "error"); }
    finally { setSaving(false); }
  };

  const handleCardTaxChange = async (level: string, value: string) => {
    if (level === "category") {
      setCardForm({ ...cardForm, categoryId: value, subjectId: "", topicId: "", subtopicId: "" });
      setSubjects(value ? await loadTax("subject", value) : []);
      setTopics([]);
      setSubtopics([]);
    } else if (level === "subject") {
      setCardForm({ ...cardForm, subjectId: value, topicId: "", subtopicId: "" });
      setTopics(value ? await loadTax("topic", value) : []);
      setSubtopics([]);
    } else if (level === "topic") {
      setCardForm({ ...cardForm, topicId: value, subtopicId: "" });
      setSubtopics(value ? await loadTax("subtopic", value) : []);
    } else if (level === "subtopic") {
      setCardForm({ ...cardForm, subtopicId: value });
    }
  };

  const handleNewDeckTaxChange = async (level: string, value: string) => {
    if (level === "category") {
      setNewDeckForm({ ...newDeckForm, categoryId: value, subjectId: "", topicId: "" });
      setNewDeckSubjects(value ? await loadTax("subject", value) : []);
      setNewDeckTopics([]);
    } else if (level === "subject") {
      setNewDeckForm({ ...newDeckForm, subjectId: value, topicId: "" });
      setNewDeckTopics(value ? await loadTax("topic", value) : []);
    } else if (level === "topic") {
      setNewDeckForm({ ...newDeckForm, topicId: value });
    }
  };

  const handleDeckTaxChange = async (level: string, value: string) => {
    if (level === "category") {
      setDeckForm({ ...deckForm, categoryId: value, subjectId: "", topicId: "" });
      setDeckSubjects(value ? await loadTax("subject", value) : []);
      setDeckTopics([]);
    } else if (level === "subject") {
      setDeckForm({ ...deckForm, subjectId: value, topicId: "" });
      setDeckTopics(value ? await loadTax("topic", value) : []);
    } else if (level === "topic") {
      setDeckForm({ ...deckForm, topicId: value });
    }
  };

  const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max) + "..." : s;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px",
    fontSize: "0.875rem", outline: "none",
  };
  const btnPrimary: React.CSSProperties = {
    padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none",
    borderRadius: "6px", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500,
  };
  const btnSecondary: React.CSSProperties = {
    padding: "8px 16px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db",
    borderRadius: "6px", cursor: "pointer", fontSize: "0.875rem",
  };
  const btnDanger: React.CSSProperties = {
    padding: "8px 16px", background: "#ef4444", color: "#fff", border: "none",
    borderRadius: "6px", cursor: "pointer", fontSize: "0.875rem",
  };
  const btnSmall: React.CSSProperties = {
    padding: "4px 8px", fontSize: "0.75rem", border: "1px solid #d1d5db",
    borderRadius: "4px", cursor: "pointer", background: "#fff",
  };
  const badge = (published: boolean): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 600,
    background: published ? "#dcfce7" : "#fef3c7", color: published ? "#166534" : "#92400e",
  });

  return (
    <div style={{ display: "flex", gap: "24px", height: "calc(100vh - 100px)" }}>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, padding: "12px 20px", borderRadius: "8px", zIndex: 9999,
          background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
          color: toast.type === "success" ? "#166534" : "#991b1b",
          boxShadow: "0 4px 12px rgba(0,0,0,.15)", fontWeight: 500, fontSize: "0.875rem",
        }}>
          {toast.msg}
        </div>
      )}

      {/* LEFT PANEL: Deck List */}
      <div style={{ width: "320px", minWidth: "320px", borderRight: "1px solid #e5e7eb", paddingRight: "16px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#111" }}>Flashcard Decks</h1>
          <button style={btnPrimary} onClick={() => { setShowNewDeck(true); setNewDeckForm({ title: "", description: "", categoryId: "", subjectId: "", topicId: "" }); setNewDeckSubjects([]); setNewDeckTopics([]); }}>
            + New Deck
          </button>
        </div>

        <input
          type="text"
          placeholder="Search decks..."
          value={deckSearch}
          onChange={(e) => { setDeckSearch(e.target.value); setDeckPage(1); }}
          style={{ ...inputStyle, marginBottom: "8px" }}
        />

        <select
          value={pubFilter}
          onChange={(e) => { setPubFilter(e.target.value); setDeckPage(1); }}
          style={{ ...inputStyle, marginBottom: "12px" }}
        >
          <option value="">All</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loadingDecks ? (
            <p style={{ color: "#9ca3af", padding: "16px", textAlign: "center" }}>Loading...</p>
          ) : decks.length === 0 ? (
            <p style={{ color: "#9ca3af", padding: "16px", textAlign: "center" }}>No decks found</p>
          ) : (
            decks.map((d) => (
              <div
                key={d.id}
                onClick={() => selectDeck(d)}
                style={{
                  padding: "10px 12px", borderRadius: "6px", cursor: "pointer", marginBottom: "4px",
                  background: selectedDeck?.id === d.id ? "#eff6ff" : "transparent",
                  border: selectedDeck?.id === d.id ? "1px solid #bfdbfe" : "1px solid transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "#111" }}>{truncate(d.title, 30)}</span>
                  <span style={badge(d.isPublished)}>{d.isPublished ? "Published" : "Draft"}</span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{d._count?.cards || 0} cards</span>
              </div>
            ))
          )}
        </div>

        {deckTotalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #e5e7eb" }}>
            <button style={btnSmall} disabled={deckPage <= 1} onClick={() => setDeckPage(deckPage - 1)}>Prev</button>
            <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{deckPage}/{deckTotalPages}</span>
            <button style={btnSmall} disabled={deckPage >= deckTotalPages} onClick={() => setDeckPage(deckPage + 1)}>Next</button>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Deck Detail + Cards */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!selectedDeck ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af" }}>
            Select a deck from the left, or create a new one
          </div>
        ) : (
          <div>
            {/* Deck Header */}
            <div style={{ marginBottom: "20px", padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              {editingDeck ? (
                <div>
                  <div style={{ marginBottom: "8px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Title *</label>
                    <input style={inputStyle} value={deckForm.title} onChange={(e) => setDeckForm({ ...deckForm, title: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: "8px" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Description</label>
                    <textarea style={{ ...inputStyle, minHeight: "60px" }} value={deckForm.description} onChange={(e) => setDeckForm({ ...deckForm, description: e.target.value })} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Category</label>
                      <select style={inputStyle} value={deckForm.categoryId} onChange={(e) => handleDeckTaxChange("category", e.target.value)}>
                        <option value="">None</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Subject</label>
                      <select style={inputStyle} value={deckForm.subjectId} onChange={(e) => handleDeckTaxChange("subject", e.target.value)} disabled={!deckForm.categoryId}>
                        <option value="">None</option>
                        {deckSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Topic</label>
                      <select style={inputStyle} value={deckForm.topicId} onChange={(e) => handleDeckTaxChange("topic", e.target.value)} disabled={!deckForm.subjectId}>
                        <option value="">None</option>
                        {deckTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd", marginBottom: "8px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", cursor: "pointer", whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={deckForm.xpEnabled} onChange={(e) => setDeckForm({ ...deckForm, xpEnabled: e.target.checked })} />
                      XP Reward
                    </label>
                    {deckForm.xpEnabled && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input type="number" min="0" value={deckForm.xpValue} onChange={(e) => setDeckForm({ ...deckForm, xpValue: e.target.value })} style={{ ...inputStyle, width: "80px" }} placeholder="XP" />
                        <span style={{ fontSize: "0.72rem", color: "#0369a1" }}>XP on completion</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button style={btnPrimary} onClick={handleUpdateDeck} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
                    <button style={btnSecondary} onClick={() => setEditingDeck(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#111", margin: 0 }}>{selectedDeck.title}</h2>
                      {selectedDeck.description && <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: "4px 0 0" }}>{selectedDeck.description}</p>}
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={badge(selectedDeck.isPublished)}>{selectedDeck.isPublished ? "Published" : "Draft"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button style={btnSecondary} onClick={() => setEditingDeck(true)}>Edit Deck</button>
                    <button
                      style={{ ...btnSecondary, color: selectedDeck.isPublished ? "#92400e" : "#166534" }}
                      onClick={handleTogglePublish}
                      disabled={saving}
                    >
                      {selectedDeck.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    <button style={btnDanger} onClick={handleDeleteDeck} disabled={saving}>Delete Deck</button>
                  </div>
                </div>
              )}
            </div>

            {/* Cards Section */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#111", margin: 0 }}>
                  Cards ({cards.length})
                </h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  {orderChanged && (
                    <button style={{ ...btnPrimary, background: "#f59e0b" }} onClick={handleSaveOrder} disabled={saving}>
                      {saving ? "Saving..." : "Save Order"}
                    </button>
                  )}
                  <button style={btnPrimary} onClick={() => openCardEditor()}>+ Add Card</button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Search cards..."
                value={cardSearch}
                onChange={(e) => { setCardSearch(e.target.value); setCardPage(1); }}
                style={{ ...inputStyle, marginBottom: "12px", maxWidth: "300px" }}
              />

              {loadingCards ? (
                <p style={{ color: "#9ca3af", textAlign: "center" }}>Loading cards...</p>
              ) : cards.length === 0 ? (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "24px" }}>No cards yet. Click "+ Add Card" to create one.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                      <th style={{ padding: "8px", width: "40px" }}>#</th>
                      <th style={{ padding: "8px" }}>Front</th>
                      <th style={{ padding: "8px" }}>Back</th>
                      <th style={{ padding: "8px" }}>Subtopic</th>
                      <th style={{ padding: "8px", width: "180px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px", color: "#9ca3af" }}>{i + 1}</td>
                        <td style={{ padding: "8px" }}>{truncate(c.front, 50)}</td>
                        <td style={{ padding: "8px" }}>{truncate(c.back, 50)}</td>
                        <td style={{ padding: "8px", color: "#6b7280" }}>{c.subtopic?.name || "-"}</td>
                        <td style={{ padding: "8px" }}>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button style={btnSmall} onClick={() => moveCard(i, "up")} disabled={i === 0} title="Move up">&#9650;</button>
                            <button style={btnSmall} onClick={() => moveCard(i, "down")} disabled={i === cards.length - 1} title="Move down">&#9660;</button>
                            <button style={{ ...btnSmall, color: "#2563eb" }} onClick={() => openCardEditor(c)}>Edit</button>
                            <button style={{ ...btnSmall, color: "#ef4444" }} onClick={() => handleDeleteCard(c.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {cardTotalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "12px" }}>
                  <button style={btnSmall} disabled={cardPage <= 1} onClick={() => setCardPage(cardPage - 1)}>Prev</button>
                  <span style={{ fontSize: "0.8rem", color: "#6b7280", lineHeight: "28px" }}>{cardPage}/{cardTotalPages}</span>
                  <button style={btnSmall} disabled={cardPage >= cardTotalPages} onClick={() => setCardPage(cardPage + 1)}>Next</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* NEW DECK MODAL */}
      {showNewDeck && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "480px", maxHeight: "80vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 16px" }}>New Deck</h3>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Title *</label>
              <input style={inputStyle} value={newDeckForm.title} onChange={(e) => setNewDeckForm({ ...newDeckForm, title: e.target.value })} />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Description</label>
              <textarea style={{ ...inputStyle, minHeight: "60px" }} value={newDeckForm.description} onChange={(e) => setNewDeckForm({ ...newDeckForm, description: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Category</label>
                <select style={inputStyle} value={newDeckForm.categoryId} onChange={(e) => handleNewDeckTaxChange("category", e.target.value)}>
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Subject</label>
                <select style={inputStyle} value={newDeckForm.subjectId} onChange={(e) => handleNewDeckTaxChange("subject", e.target.value)} disabled={!newDeckForm.categoryId}>
                  <option value="">None</option>
                  {newDeckSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Topic</label>
                <select style={inputStyle} value={newDeckForm.topicId} onChange={(e) => handleNewDeckTaxChange("topic", e.target.value)} disabled={!newDeckForm.subjectId}>
                  <option value="">None</option>
                  {newDeckTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd", marginBottom: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={newDeckForm.xpEnabled} onChange={(e) => setNewDeckForm({ ...newDeckForm, xpEnabled: e.target.checked })} />
                XP Reward
              </label>
              {newDeckForm.xpEnabled && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input type="number" min="0" value={newDeckForm.xpValue} onChange={(e) => setNewDeckForm({ ...newDeckForm, xpValue: e.target.value })} style={{ ...inputStyle, width: "80px" }} placeholder="XP" />
                  <span style={{ fontSize: "0.72rem", color: "#0369a1" }}>XP on completion</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnSecondary} onClick={() => setShowNewDeck(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleCreateDeck} disabled={saving}>{saving ? "Creating..." : "Create Deck"}</button>
            </div>
          </div>
        </div>
      )}

      {/* CARD EDITOR MODAL */}
      {showCardModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "560px", maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 16px" }}>{editingCard ? "Edit Card" : "Add Card"}</h3>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Front (question) *</label>
              <textarea style={{ ...inputStyle, minHeight: "80px" }} value={cardForm.front} onChange={(e) => setCardForm({ ...cardForm, front: e.target.value })} />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Back (explanation) *</label>
              <textarea style={{ ...inputStyle, minHeight: "80px" }} value={cardForm.back} onChange={(e) => setCardForm({ ...cardForm, back: e.target.value })} />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Image URL (optional)</label>
              <input style={inputStyle} value={cardForm.imageUrl} onChange={(e) => setCardForm({ ...cardForm, imageUrl: e.target.value })} placeholder="https://..." />
              {cardForm.imageUrl && (
                <div style={{ marginTop: "8px" }}>
                  <img
                    src={cardForm.imageUrl}
                    alt="Preview"
                    style={{ maxWidth: "200px", maxHeight: "120px", borderRadius: "6px", border: "1px solid #e5e7eb" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "6px", display: "block" }}>Taxonomy (optional)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "0.7rem", color: "#6b7280" }}>Category</label>
                  <select style={inputStyle} value={cardForm.categoryId} onChange={(e) => handleCardTaxChange("category", e.target.value)}>
                    <option value="">None</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.7rem", color: "#6b7280" }}>Subject</label>
                  <select style={inputStyle} value={cardForm.subjectId} onChange={(e) => handleCardTaxChange("subject", e.target.value)} disabled={!cardForm.categoryId}>
                    <option value="">None</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.7rem", color: "#6b7280" }}>Topic</label>
                  <select style={inputStyle} value={cardForm.topicId} onChange={(e) => handleCardTaxChange("topic", e.target.value)} disabled={!cardForm.subjectId}>
                    <option value="">None</option>
                    {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.7rem", color: "#6b7280" }}>Subtopic</label>
                  <select style={inputStyle} value={cardForm.subtopicId} onChange={(e) => handleCardTaxChange("subtopic", e.target.value)} disabled={!cardForm.topicId}>
                    <option value="">None</option>
                    {subtopics.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnSecondary} onClick={() => setShowCardModal(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleSaveCard} disabled={saving}>{saving ? "Saving..." : editingCard ? "Update Card" : "Add Card"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
