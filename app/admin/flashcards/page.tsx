"use client";

import { useState, useEffect, useCallback } from "react";
import { SUBJECT_COLOR_LIST, DEFAULT_SUBJECT_COLOR } from "@/lib/subjectColors";
import { TITLE_TEMPLATES } from "@/lib/titleTemplates";
import RichTextEditor from "@/components/ui/RichTextEditor";
import AdminImageUploader from "@/components/admin/AdminImageUploader";
import BlockEditor from "@/components/ui/BlockEditor";
import { BlockDoc, isBlockDoc } from "@/lib/blocks/schema";
import { htmlToBlocks, emptyDocWithParagraph, blocksToHtmlString } from "@/lib/blocks/defaults";

const CARD_TYPES = [
  { value: "TITLE",          label: "Title Card",              desc: "Deck cover / opener" },
  { value: "INFO",           label: "Info Card",               desc: "One-sided content card" },
  { value: "QUIZ",           label: "Quiz Card",               desc: "MCQ with submit + flip" },
  { value: "COMPARISON",     label: "Comparison / Table",      desc: "2-col or multi-col table" },
  { value: "FILL_IN_BLANK",  label: "Fill in the Blank",       desc: "Typed-answer blank(s)" },
  { value: "MATCHING",       label: "Matching Card",           desc: "Left ↔ Right matching" },
  { value: "REORDER",        label: "Reorder Card",            desc: "Arrange items in order" },
  { value: "CATEGORIZATION", label: "Categorization",          desc: "Drag items into categories" },
];

interface FlashcardDeck {
  id: string; title: string; subtitle: string | null; description: string | null;
  categoryId: string | null; subjectId: string | null; topicId: string | null;
  titleTemplate: string; titleImageUrl: string | null; subjectColor: string | null;
  xpEnabled?: boolean; xpValue?: number; isPublished: boolean; createdAt: string;
  _count?: { cards: number };
}
interface FlashcardCard {
  id: string; deckId: string; cardType: string; front: string; back: string;
  imageUrl: string | null; subtopicId: string | null; order: number;
  content: Record<string, any> | null;
  subtopic?: { id: string; name: string; topicId: string;
    topic?: { id: string; name: string; subjectId: string;
      subject?: { id: string; name: string; categoryId: string };
    };
  } | null;
}
interface TaxItem { id: string; name: string; }

type CardTypeForm = {
  cardType: string; subtopicId: string; imageUrl: string;
  categoryId: string; subjectId: string; topicId: string;
  front: string; back: string;
  titleTemplate: string; titleTitle: string; titleSubtitle: string; titleImageUrl: string;
  infoTitle: string; infoBody: string; infoExample: string;
  infoBodyBlocks: BlockDoc; infoExampleBlocks: BlockDoc;
  quizQuestion: string; quizExplanation: string;
  compTitle: string;
  fillSentence: string; fillExplanation: string;
  matchExplanation: string;
  reorderExplanation: string;
  catExplanation: string;
};

const emptyCardForm = (): CardTypeForm => ({
  cardType: "INFO", subtopicId: "", imageUrl: "",
  categoryId: "", subjectId: "", topicId: "",
  front: "", back: "",
  titleTemplate: "minimal_academic", titleTitle: "", titleSubtitle: "", titleImageUrl: "",
  infoTitle: "", infoBody: "", infoExample: "",
  infoBodyBlocks: emptyDocWithParagraph(), infoExampleBlocks: emptyDocWithParagraph(),
  quizQuestion: "", quizExplanation: "",
  compTitle: "",
  fillSentence: "", fillExplanation: "",
  matchExplanation: "",
  reorderExplanation: "",
  catExplanation: "",
});

type DeckForm = {
  title: string; subtitle: string; description: string;
  categoryId: string; subjectId: string; topicId: string;
  examId: string;
  titleTemplate: string; titleImageUrl: string; subjectColor: string;
  xpEnabled: boolean; xpValue: string;
  unlockAt: string;
};
const emptyDeckForm = (): DeckForm => ({
  title: "", subtitle: "", description: "",
  categoryId: "", subjectId: "", topicId: "",
  examId: "",
  titleTemplate: "minimal_academic", titleImageUrl: "", subjectColor: "",
  xpEnabled: false, xpValue: "",
  unlockAt: "",
});

type ExamItem = { id: string; name: string; categoryId: string };

export default function FlashcardsPage() {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [deckSearch, setDeckSearch] = useState("");
  const [pubFilter, setPubFilter] = useState("");
  const [deckPage, setDeckPage] = useState(1);
  const [deckTotalPages, setDeckTotalPages] = useState(1);

  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [editingDeck, setEditingDeck] = useState(false);
  const [deckForm, setDeckForm] = useState<DeckForm>(emptyDeckForm());

  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardPage, setCardPage] = useState(1);
  const [cardTotalPages, setCardTotalPages] = useState(1);
  const [cardSearch, setCardSearch] = useState("");
  const [cardTotal, setCardTotal] = useState(0);
  const [allCardsLoaded, setAllCardsLoaded] = useState(false);
  const [orderChanged, setOrderChanged] = useState(false);

  const [showNewDeck, setShowNewDeck] = useState(false);
  const [newDeckForm, setNewDeckForm] = useState<DeckForm>(emptyDeckForm());
  const [newDeckSubjects, setNewDeckSubjects] = useState<TaxItem[]>([]);
  const [newDeckTopics, setNewDeckTopics] = useState<TaxItem[]>([]);

  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashcardCard | null>(null);
  const [cardForm, setCardForm] = useState<CardTypeForm>(emptyCardForm());

  const [quizOptions, setQuizOptions] = useState<{ text: string; isCorrect: boolean }[]>([
    { text: "", isCorrect: false }, { text: "", isCorrect: false },
  ]);
  const [matchPairs, setMatchPairs] = useState<{ left: string; right: string }[]>([{ left: "", right: "" }]);
  const [reorderItems, setReorderItems] = useState<string[]>(["", ""]);
  const [compHeaders, setCompHeaders] = useState<string[]>(["Column 1", "Column 2"]);
  const [compRows, setCompRows] = useState<string[][]>([["", ""]]);
  const [catCategories, setCatCategories] = useState<string[]>(["Category A", "Category B"]);
  const [catItems, setCatItems] = useState<{ text: string; category: string }[]>([{ text: "", category: "Category A" }]);
  const [keyPoints, setKeyPoints] = useState<string[]>(["", ""]);
  const [fillBlanks, setFillBlanks] = useState<{ id: string; accepted: string }[]>([{ id: "b1", accepted: "" }]);

  const [categories, setCategories] = useState<TaxItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [cardSubjects, setCardSubjects] = useState<TaxItem[]>([]);
  const [cardTopics, setCardTopics] = useState<TaxItem[]>([]);
  const [cardSubtopics, setCardSubtopics] = useState<TaxItem[]>([]);
  const [deckSubjects, setDeckSubjects] = useState<TaxItem[]>([]);
  const [deckTopics, setDeckTopics] = useState<TaxItem[]>([]);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);

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
    fetch("/api/exams").then(r => r.json()).then(j => setExams(j.exams || [])).catch(() => {});
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
    } catch { showToast("Failed to load decks", "error"); }
    finally { setLoadingDecks(false); }
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
    } catch { showToast("Failed to load cards", "error"); }
    finally { setLoadingCards(false); }
  }, [cardPage, cardSearch]);

  useEffect(() => { if (selectedDeck) loadCards(selectedDeck.id); }, [selectedDeck, loadCards]);

  const deckToForm = (d: FlashcardDeck & { examId?: string | null }): DeckForm => ({
    title: d.title, subtitle: d.subtitle || "", description: d.description || "",
    categoryId: d.categoryId || "", subjectId: d.subjectId || "", topicId: d.topicId || "",
    examId: d.examId || "",
    titleTemplate: d.titleTemplate || "minimal_academic",
    titleImageUrl: d.titleImageUrl || "", subjectColor: d.subjectColor || "",
    xpEnabled: d.xpEnabled || false, xpValue: d.xpValue != null ? String(d.xpValue) : "",
    unlockAt: (d as any).unlockAt ? (d as any).unlockAt.slice(0, 16) : "",
  });

  const selectDeck = (d: FlashcardDeck) => {
    setSelectedDeck(d); setEditingDeck(false);
    setCardPage(1); setCardSearch("");
    setOrderChanged(false); setAllCardsLoaded(false);
    setDeckForm(deckToForm(d));
    if (d.categoryId) loadTax("subject", d.categoryId).then(setDeckSubjects); else setDeckSubjects([]);
    if (d.subjectId) loadTax("topic", d.subjectId).then(setDeckTopics); else setDeckTopics([]);
  };

  const handleCreateDeck = async () => {
    if (!newDeckForm.title.trim()) { showToast("Title required", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/flashcards/decks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDeckForm.title, subtitle: newDeckForm.subtitle || null,
          description: newDeckForm.description || null,
          categoryId: newDeckForm.categoryId || null, subjectId: newDeckForm.subjectId || null,
          topicId: newDeckForm.topicId || null,
          examId: newDeckForm.examId || null,
          titleTemplate: newDeckForm.titleTemplate || "minimal_academic",
          titleImageUrl: newDeckForm.titleImageUrl || null,
          subjectColor: newDeckForm.subjectColor || null,
          xpEnabled: newDeckForm.xpEnabled,
          xpValue: parseInt(newDeckForm.xpValue) || 0,
          unlockAt: newDeckForm.unlockAt ? newDeckForm.unlockAt + ":00+05:30" : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Deck created", "success");
      setShowNewDeck(false); setNewDeckForm(emptyDeckForm());
      setNewDeckSubjects([]); setNewDeckTopics([]);
      loadDecks(); selectDeck(json.data);
    } catch { showToast("Failed to create deck", "error"); }
    finally { setSaving(false); }
  };

  const handleUpdateDeck = async () => {
    if (!selectedDeck || !deckForm.title.trim()) { showToast("Title required", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${selectedDeck.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: deckForm.title, subtitle: deckForm.subtitle || null,
          description: deckForm.description || null,
          categoryId: deckForm.categoryId || null, subjectId: deckForm.subjectId || null,
          topicId: deckForm.topicId || null,
          examId: deckForm.examId || null,
          titleTemplate: deckForm.titleTemplate || "minimal_academic",
          titleImageUrl: deckForm.titleImageUrl || null,
          subjectColor: deckForm.subjectColor || null,
          xpEnabled: deckForm.xpEnabled, xpValue: parseInt(deckForm.xpValue) || 0,
          unlockAt: deckForm.unlockAt ? deckForm.unlockAt + ":00+05:30" : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Deck updated", "success");
      setEditingDeck(false); setSelectedDeck(json.data); loadDecks();
    } catch { showToast("Failed to update", "error"); }
    finally { setSaving(false); }
  };

  const handleTogglePublish = async () => {
    if (!selectedDeck) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${selectedDeck.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
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
    if (!confirm(`Delete deck "${selectedDeck.title}"? This deletes all cards.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${selectedDeck.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed to delete", "error"); return; }
      showToast("Deck deleted", "success"); setSelectedDeck(null); loadDecks();
    } catch { showToast("Failed to delete", "error"); }
    finally { setSaving(false); }
  };

  const buildCardContent = (form: CardTypeForm): { content: Record<string, any>; front: string; back: string } => {
    switch (form.cardType) {
      case "TITLE":
        return {
          content: {
            template: form.titleTemplate, titleOverride: form.titleTitle || null,
            subtitle: form.titleSubtitle || null, imageUrl: form.titleImageUrl || null,
          },
          front: form.titleTitle || "(Title Card)", back: "",
        };
      case "INFO": {
        const bodyHtml = blocksToHtmlString(form.infoBodyBlocks);
        const exampleHtml = blocksToHtmlString(form.infoExampleBlocks);
        const plainBody = bodyHtml.replace(/<[^>]*>/g, "").trim();
        return {
          content: {
            title: form.infoTitle,
            body: bodyHtml,
            bodyBlocks: form.infoBodyBlocks,
            keyPoints: keyPoints.filter((k) => k.trim()),
            example: exampleHtml || null,
            exampleBlocks: form.infoExampleBlocks,
            imageUrl: form.imageUrl || null,
          },
          front: form.infoTitle || plainBody.slice(0, 60) || "Info Card",
          back: "",
        };
      }
      case "QUIZ":
        return {
          content: {
            question: form.quizQuestion,
            options: quizOptions.filter((o) => o.text.trim()),
            explanation: form.quizExplanation,
          },
          front: form.quizQuestion, back: form.quizExplanation,
        };
      case "COMPARISON":
        return {
          content: { title: form.compTitle, headers: compHeaders, rows: compRows },
          front: form.compTitle || "Comparison", back: "",
        };
      case "FILL_IN_BLANK":
        return {
          content: {
            sentence: form.fillSentence,
            blanks: fillBlanks.map((b) => ({ id: b.id, accepted: b.accepted.split(",").map((s) => s.trim()).filter(Boolean) })),
            explanation: form.fillExplanation,
          },
          front: form.fillSentence, back: form.fillExplanation,
        };
      case "MATCHING":
        return {
          content: { pairs: matchPairs.filter((p) => p.left.trim() && p.right.trim()), explanation: form.matchExplanation },
          front: "Matching exercise", back: form.matchExplanation,
        };
      case "REORDER":
        return {
          content: { items: reorderItems.filter((i) => i.trim()), explanation: form.reorderExplanation },
          front: "Arrange in correct order", back: form.reorderExplanation,
        };
      case "CATEGORIZATION":
        return {
          content: {
            categories: catCategories.filter((c) => c.trim()),
            items: catItems.filter((i) => i.text.trim()),
            explanation: form.catExplanation,
          },
          front: "Categorization exercise", back: form.catExplanation,
        };
      default:
        return { content: {}, front: form.front, back: form.back };
    }
  };

  const populateFormFromCard = (card: FlashcardCard) => {
    const base: CardTypeForm = {
      ...emptyCardForm(),
      cardType: card.cardType, subtopicId: card.subtopicId || "",
      imageUrl: card.imageUrl || "", front: card.front, back: card.back,
      categoryId: card.subtopic?.topic?.subject?.categoryId || "",
      subjectId: card.subtopic?.topic?.subjectId || "",
      topicId: card.subtopic?.topicId || "",
    };
    const c = card.content || {};
    if (card.cardType === "TITLE") {
      base.titleTemplate = c.template || "minimal_academic";
      base.titleTitle = c.titleOverride || ""; base.titleSubtitle = c.subtitle || "";
      base.titleImageUrl = c.imageUrl || "";
    } else if (card.cardType === "INFO") {
      base.infoTitle = c.title || ""; base.infoBody = c.body || "";
      base.infoExample = c.example || "";
      base.infoBodyBlocks = isBlockDoc(c.bodyBlocks) ? c.bodyBlocks : htmlToBlocks(c.body || "");
      base.infoExampleBlocks = isBlockDoc(c.exampleBlocks) ? c.exampleBlocks : htmlToBlocks(c.example || "");
      setKeyPoints(c.keyPoints?.length ? c.keyPoints : ["", ""]);
    } else if (card.cardType === "QUIZ") {
      base.quizQuestion = c.question || ""; base.quizExplanation = c.explanation || "";
      setQuizOptions(c.options?.length ? c.options : [{ text: "", isCorrect: false }, { text: "", isCorrect: false }]);
    } else if (card.cardType === "COMPARISON") {
      base.compTitle = c.title || "";
      setCompHeaders(c.headers?.length ? c.headers : ["Column 1", "Column 2"]);
      setCompRows(c.rows?.length ? c.rows : [["", ""]]);
    } else if (card.cardType === "FILL_IN_BLANK") {
      base.fillSentence = c.sentence || ""; base.fillExplanation = c.explanation || "";
      setFillBlanks(c.blanks?.length
        ? c.blanks.map((b: any) => ({ id: b.id, accepted: (b.accepted || []).join(", ") }))
        : [{ id: "b1", accepted: "" }]);
    } else if (card.cardType === "MATCHING") {
      base.matchExplanation = c.explanation || "";
      setMatchPairs(c.pairs?.length ? c.pairs : [{ left: "", right: "" }]);
    } else if (card.cardType === "REORDER") {
      base.reorderExplanation = c.explanation || "";
      setReorderItems(c.items?.length ? c.items : ["", ""]);
    } else if (card.cardType === "CATEGORIZATION") {
      base.catExplanation = c.explanation || "";
      setCatCategories(c.categories?.length ? c.categories : ["Category A", "Category B"]);
      setCatItems(c.items?.length ? c.items : [{ text: "", category: "Category A" }]);
    }
    return base;
  };

  const openCardEditor = (card?: FlashcardCard) => {
    if (card) {
      setEditingCard(card);
      const f = populateFormFromCard(card);
      setCardForm(f);
      if (f.categoryId) loadTax("subject", f.categoryId).then(setCardSubjects);
      if (f.subjectId) loadTax("topic", f.subjectId).then(setCardTopics);
      if (f.topicId) loadTax("subtopic", f.topicId).then(setCardSubtopics);
    } else {
      setEditingCard(null);
      setCardForm(emptyCardForm());
      setQuizOptions([{ text: "", isCorrect: false }, { text: "", isCorrect: false }]);
      setMatchPairs([{ left: "", right: "" }]);
      setReorderItems(["", ""]); setCompHeaders(["Column 1", "Column 2"]);
      setCompRows([[""]]); setKeyPoints(["", ""]);
      setFillBlanks([{ id: "b1", accepted: "" }]);
      setCatCategories(["Category A", "Category B"]);
      setCatItems([{ text: "", category: "Category A" }]);
      setCardSubjects([]); setCardTopics([]); setCardSubtopics([]);
    }
    setShowCardModal(true);
  };

  const validateCardForm = (form: CardTypeForm): string | null => {
    switch (form.cardType) {
      case "QUIZ":
        if (!form.quizQuestion.trim()) return "Question is required";
        if (quizOptions.filter((o) => o.text.trim()).length < 2) return "At least 2 options required";
        if (!quizOptions.some((o) => o.isCorrect)) return "Mark at least one correct answer";
        return null;
      case "FILL_IN_BLANK":
        if (!form.fillSentence.trim()) return "Sentence is required";
        if (fillBlanks.some((b) => !b.accepted.trim())) return "Each blank needs accepted answers";
        return null;
      case "MATCHING":
        if (matchPairs.filter((p) => p.left.trim() && p.right.trim()).length < 2) return "At least 2 pairs required";
        return null;
      case "REORDER":
        if (reorderItems.filter((i) => i.trim()).length < 2) return "At least 2 items required";
        return null;
      case "CATEGORIZATION":
        if (catCategories.filter((c) => c.trim()).length < 2) return "At least 2 categories required";
        if (catItems.filter((i) => i.text.trim()).length < 2) return "At least 2 items required";
        return null;
      case "INFO":
        if (form.infoBodyBlocks.blocks.length === 0 && !form.infoTitle.trim()) return "Title or body content is required";
        return null;
      default:
        return null;
    }
  };

  const handleSaveCard = async () => {
    if (!selectedDeck) return;
    const validError = validateCardForm(cardForm);
    if (validError) { showToast(validError, "error"); return; }
    setSaving(true);
    try {
      const { content, front, back } = buildCardContent(cardForm);
      const payload = {
        deckId: selectedDeck.id,
        cardType: cardForm.cardType,
        front, back, content,
        imageUrl: cardForm.imageUrl || null,
        subtopicId: cardForm.subtopicId || null,
      };
      let res;
      if (editingCard) {
        res = await fetch(`/api/flashcards/cards/${editingCard.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/flashcards/cards", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast(editingCard ? "Card updated" : "Card added", "success");
      setShowCardModal(false); loadCards(selectedDeck.id); loadDecks();
    } catch { showToast("Failed to save card", "error"); }
    finally { setSaving(false); }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!selectedDeck || !confirm("Delete this card?")) return;
    try {
      const res = await fetch(`/api/flashcards/cards/${cardId}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json(); showToast(j.error || "Failed", "error"); return; }
      showToast("Card deleted", "success"); loadCards(selectedDeck.id); loadDecks();
    } catch { showToast("Failed to delete", "error"); }
  };

  const loadAllCards = async (deckId: string) => {
    try {
      const res = await fetch(`/api/flashcards/decks/${deckId}/cards?pageSize=1000`);
      const json = await res.json();
      setCards(json.items || []); setAllCardsLoaded(true); return true;
    } catch { showToast("Failed to load all cards", "error"); return false; }
  };

  const moveCard = async (index: number, direction: "up" | "down") => {
    if (!allCardsLoaded && cardTotal > 25 && selectedDeck) {
      const ok = await loadAllCards(selectedDeck.id);
      if (!ok) return;
      showToast("Loaded all cards for reordering", "success"); return;
    }
    const newCards = [...cards];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newCards.length) return;
    [newCards[index], newCards[swapIdx]] = [newCards[swapIdx], newCards[index]];
    setCards(newCards); setOrderChanged(true);
  };

  const handleSaveOrder = async () => {
    if (!selectedDeck) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/flashcards/decks/${selectedDeck.id}/reorder`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedCardIds: cards.map((c) => c.id) }),
      });
      if (!res.ok) { const j = await res.json(); showToast(j.error || "Failed", "error"); return; }
      showToast("Order saved", "success"); setOrderChanged(false); setAllCardsLoaded(false);
      loadCards(selectedDeck.id);
    } catch { showToast("Failed to save order", "error"); }
    finally { setSaving(false); }
  };

  const handleCardTaxChange = async (level: string, value: string) => {
    if (level === "category") {
      setCardForm((f) => ({ ...f, categoryId: value, subjectId: "", topicId: "", subtopicId: "" }));
      setCardSubjects(value ? await loadTax("subject", value) : []);
      setCardTopics([]); setCardSubtopics([]);
    } else if (level === "subject") {
      setCardForm((f) => ({ ...f, subjectId: value, topicId: "", subtopicId: "" }));
      setCardTopics(value ? await loadTax("topic", value) : []); setCardSubtopics([]);
    } else if (level === "topic") {
      setCardForm((f) => ({ ...f, topicId: value, subtopicId: "" }));
      setCardSubtopics(value ? await loadTax("subtopic", value) : []);
    } else {
      setCardForm((f) => ({ ...f, subtopicId: value }));
    }
  };

  const handleNewDeckTaxChange = async (level: string, value: string) => {
    if (level === "category") {
      setNewDeckForm((f) => ({ ...f, categoryId: value, examId: "", subjectId: "", topicId: "" }));
      setNewDeckSubjects(value ? await loadTax("subject", value) : []); setNewDeckTopics([]);
    } else if (level === "subject") {
      setNewDeckForm((f) => ({ ...f, subjectId: value, topicId: "" }));
      setNewDeckTopics(value ? await loadTax("topic", value) : []);
    } else {
      setNewDeckForm((f) => ({ ...f, topicId: value }));
    }
  };

  const handleDeckTaxChange = async (level: string, value: string) => {
    if (level === "category") {
      setDeckForm((f) => ({ ...f, categoryId: value, examId: "", subjectId: "", topicId: "" }));
      setDeckSubjects(value ? await loadTax("subject", value) : []); setDeckTopics([]);
    } else if (level === "subject") {
      setDeckForm((f) => ({ ...f, subjectId: value, topicId: "" }));
      setDeckTopics(value ? await loadTax("topic", value) : []);
    } else {
      setDeckForm((f) => ({ ...f, topicId: value }));
    }
  };

  const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max) + "…" : s;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px",
    fontSize: "0.875rem", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 600, color: "#374151", marginBottom: "3px", display: "block" };
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

  const cardTypeBadge = (type: string): React.CSSProperties => {
    const colors: Record<string, [string, string]> = {
      TITLE: ["#ede9fe", "#5b21b6"], INFO: ["#f0fdf4", "#166534"],
      QUIZ: ["#eff6ff", "#1d4ed8"], COMPARISON: ["#fef9c3", "#713f12"],
      FILL_IN_BLANK: ["#fdf4ff", "#6b21a8"], MATCHING: ["#fff7ed", "#9a3412"],
      REORDER: ["#f0fdf4", "#166534"], CATEGORIZATION: ["#fef2f2", "#991b1b"],
    };
    const [bg, color] = colors[type] || ["#f3f4f6", "#374151"];
    return { display: "inline-block", padding: "1px 7px", borderRadius: "9999px", fontSize: "0.68rem", fontWeight: 600, background: bg, color };
  };

  const DeckFormFields = ({ form, setForm, subjects, topics, onTaxChange, showTemplate, examList }: {
    form: DeckForm; setForm: (f: DeckForm) => void;
    subjects: TaxItem[]; topics: TaxItem[];
    onTaxChange: (level: string, value: string) => void;
    showTemplate?: boolean;
    examList?: ExamItem[];
  }) => (
    <div>
      <div style={{ marginBottom: "10px" }}>
        <label style={labelStyle}>Title *</label>
        <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div style={{ marginBottom: "10px" }}>
        <label style={labelStyle}>Subtitle (optional)</label>
        <input style={inputStyle} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Short intro shown on title card" />
      </div>
      <div style={{ marginBottom: "10px" }}>
        <label style={labelStyle}>Description</label>
        <textarea style={{ ...inputStyle, minHeight: "56px" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "10px" }}>
        <div>
          <label style={labelStyle}>Category</label>
          <select style={inputStyle} value={form.categoryId} onChange={(e) => onTaxChange("category", e.target.value)}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Subject</label>
          <select style={inputStyle} value={form.subjectId} onChange={(e) => onTaxChange("subject", e.target.value)} disabled={!form.categoryId}>
            <option value="">None</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Topic</label>
          <select style={inputStyle} value={form.topicId} onChange={(e) => onTaxChange("topic", e.target.value)} disabled={!form.subjectId}>
            <option value="">None</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      {examList && examList.length > 0 && (
        <div style={{ marginBottom: "10px" }}>
          <label style={labelStyle}>Exam <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.72rem" }}>(filtered by category)</span></label>
          <select style={inputStyle} value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })}>
            <option value="">— No Exam —</option>
            {examList.filter(ex => !form.categoryId || ex.categoryId === form.categoryId).map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
      )}
      {showTemplate && (
        <>
          <div style={{ marginBottom: "10px" }}>
            <label style={labelStyle}>Title Card Template</label>
            <select style={inputStyle} value={form.titleTemplate} onChange={(e) => setForm({ ...form, titleTemplate: e.target.value })}>
              {TITLE_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.label} — {t.description}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <AdminImageUploader
              label="Title Card Image (optional)"
              value={form.titleImageUrl || null}
              onChange={(url) => setForm({ ...form, titleImageUrl: url || "" })}
              disabled={saving}
              base64
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label style={labelStyle}>Subject Color</label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
              {SUBJECT_COLOR_LIST.map(({ name, hex }) => (
                <button key={hex} title={name} onClick={() => setForm({ ...form, subjectColor: hex })}
                  style={{ width: "22px", height: "22px", borderRadius: "50%", background: hex, border: form.subjectColor === hex ? "3px solid #111" : "2px solid transparent", cursor: "pointer" }} />
              ))}
              <button title="Default purple" onClick={() => setForm({ ...form, subjectColor: DEFAULT_SUBJECT_COLOR })}
                style={{ width: "22px", height: "22px", borderRadius: "50%", background: DEFAULT_SUBJECT_COLOR, border: form.subjectColor === DEFAULT_SUBJECT_COLOR ? "3px solid #111" : "2px solid transparent", cursor: "pointer" }} />
              <button title="Clear" onClick={() => setForm({ ...form, subjectColor: "" })}
                style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#f3f4f6", border: "1px solid #d1d5db", cursor: "pointer", fontSize: "0.65rem" }}>✕</button>
            </div>
            {form.subjectColor && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: form.subjectColor }} />
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{form.subjectColor}</span>
              </div>
            )}
          </div>
        </>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd", marginBottom: "6px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 700, color: "#0369a1", cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={form.xpEnabled} onChange={(e) => setForm({ ...form, xpEnabled: e.target.checked })} />
          XP Reward
        </label>
        {form.xpEnabled && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input type="number" min="0" value={form.xpValue} onChange={(e) => setForm({ ...form, xpValue: e.target.value })} style={{ ...inputStyle, width: "72px" }} placeholder="XP" />
            <span style={{ fontSize: "0.72rem", color: "#0369a1" }}>XP on completion</span>
          </div>
        )}
      </div>
      <div style={{ marginBottom: "6px" }}>
        <label style={labelStyle}>Unlock At <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional — leave blank for immediate access)</span></label>
        <input type="datetime-local" style={inputStyle} value={form.unlockAt} onChange={(e) => setForm({ ...form, unlockAt: e.target.value })} />
        {form.unlockAt && <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "#7c3aed" }}>Students can access this deck from {new Date(form.unlockAt).toLocaleString()} onwards.</p>}
      </div>
    </div>
  );

  const CardTypeFormFields = () => {
    const accentColor = selectedDeck?.subjectColor || DEFAULT_SUBJECT_COLOR;
    const sectionHead: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase" as const, letterSpacing: "0.05em", margin: "14px 0 6px" };
    const cf = cardForm;
    const set = (patch: Partial<CardTypeForm>) => setCardForm((f) => ({ ...f, ...patch }));

    switch (cf.cardType) {
      case "TITLE":
        return (
          <div>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Template</label>
              <select style={inputStyle} value={cf.titleTemplate} onChange={(e) => set({ titleTemplate: e.target.value })}>
                {TITLE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label} — {t.description}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Title Override (leave blank to use deck title)</label>
              <input style={inputStyle} value={cf.titleTitle} onChange={(e) => set({ titleTitle: e.target.value })} />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Subtitle</label>
              <input style={inputStyle} value={cf.titleSubtitle} onChange={(e) => set({ titleSubtitle: e.target.value })} />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <AdminImageUploader
                label="Image (optional)"
                value={cf.titleImageUrl || null}
                onChange={(url) => set({ titleImageUrl: url || "" })}
                disabled={saving}
                base64
              />
            </div>
            <div style={{ padding: "12px", background: "#faf5ff", border: "1px solid #ede9fe", borderRadius: "8px", borderLeft: `4px solid ${accentColor}` }}>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "#5b21b6" }}>Preview template: <strong>{TITLE_TEMPLATES.find(t => t.id === cf.titleTemplate)?.label}</strong></p>
              <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "#7c3aed" }}>{TITLE_TEMPLATES.find(t => t.id === cf.titleTemplate)?.description}</p>
            </div>
          </div>
        );

      case "INFO":
        return (
          <div>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Card Title</label>
              <input style={inputStyle} value={cf.infoTitle} onChange={(e) => set({ infoTitle: e.target.value })} />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <BlockEditor
                key={`fc-info-body-${editingCard?.id ?? "new"}`}
                doc={cf.infoBodyBlocks}
                onChange={(doc) => set({ infoBodyBlocks: doc })}
                config="flashcard"
                disabled={saving}
                label="Body Content *"
              />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <p style={sectionHead}>Key Points</p>
              {keyPoints.map((kp, i) => (
                <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "5px" }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={kp} onChange={(e) => { const arr = [...keyPoints]; arr[i] = e.target.value; setKeyPoints(arr); }} placeholder={`Point ${i + 1}`} />
                  {keyPoints.length > 1 && <button style={btnSmall} onClick={() => setKeyPoints(keyPoints.filter((_, j) => j !== i))}>✕</button>}
                </div>
              ))}
              <button style={{ ...btnSmall, marginTop: "4px" }} onClick={() => setKeyPoints([...keyPoints, ""])}>+ Add Point</button>
            </div>
            <div style={{ marginBottom: "10px" }}>
              <BlockEditor
                key={`fc-info-example-${editingCard?.id ?? "new"}`}
                doc={cf.infoExampleBlocks}
                onChange={(doc) => set({ infoExampleBlocks: doc })}
                config="flashcard"
                disabled={saving}
                label="Example Block (optional)"
              />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <AdminImageUploader
                label="Image (optional)"
                value={cf.imageUrl || null}
                onChange={(url) => set({ imageUrl: url || "" })}
                disabled={saving}
                base64
              />
            </div>
          </div>
        );

      case "QUIZ":
        return (
          <div>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Question *</label>
              <RichTextEditor value={cf.quizQuestion} onChange={(html) => set({ quizQuestion: html })} placeholder="Enter the question…" minHeight="100px" />
            </div>
            <p style={sectionHead}>Options (mark correct answers)</p>
            {quizOptions.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "6px", alignItems: "center" }}>
                <input type="checkbox" checked={opt.isCorrect} onChange={(e) => { const arr = [...quizOptions]; arr[i] = { ...arr[i], isCorrect: e.target.checked }; setQuizOptions(arr); }} title="Correct?" />
                <input style={{ ...inputStyle, flex: 1 }} value={opt.text} onChange={(e) => { const arr = [...quizOptions]; arr[i] = { ...arr[i], text: e.target.value }; setQuizOptions(arr); }} placeholder={`Option ${i + 1}`} />
                {quizOptions.length > 2 && <button style={btnSmall} onClick={() => setQuizOptions(quizOptions.filter((_, j) => j !== i))}>✕</button>}
              </div>
            ))}
            <button style={{ ...btnSmall, marginBottom: "10px" }} onClick={() => setQuizOptions([...quizOptions, { text: "", isCorrect: false }])}>+ Add Option</button>
            <div>
              <label style={labelStyle}>Explanation (shown after flip) *</label>
              <RichTextEditor value={cf.quizExplanation} onChange={(html) => set({ quizExplanation: html })} placeholder="Explain the correct answer…" minHeight="90px" />
            </div>
          </div>
        );

      case "COMPARISON":
        return (
          <div>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Table Title</label>
              <input style={inputStyle} value={cf.compTitle} onChange={(e) => set({ compTitle: e.target.value })} />
            </div>
            <p style={sectionHead}>Column Headers</p>
            <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
              {compHeaders.map((h, i) => (
                <div key={i} style={{ display: "flex", gap: "4px" }}>
                  <input style={{ ...inputStyle, width: "130px" }} value={h} onChange={(e) => { const arr = [...compHeaders]; arr[i] = e.target.value; setCompHeaders(arr); const newRows = compRows.map((r) => { const row = [...r]; while (row.length < arr.length) row.push(""); return row.slice(0, arr.length); }); setCompRows(newRows); }} />
                  {compHeaders.length > 2 && <button style={btnSmall} onClick={() => { const arr = compHeaders.filter((_, j) => j !== i); setCompHeaders(arr); setCompRows(compRows.map((r) => r.filter((_, j) => j !== i))); }}>✕</button>}
                </div>
              ))}
              <button style={btnSmall} onClick={() => { setCompHeaders([...compHeaders, `Col ${compHeaders.length + 1}`]); setCompRows(compRows.map((r) => [...r, ""])); }}>+ Col</button>
            </div>
            <p style={sectionHead}>Rows</p>
            {compRows.map((row, ri) => (
              <div key={ri} style={{ display: "flex", gap: "4px", marginBottom: "5px", alignItems: "center" }}>
                {row.map((cell, ci) => (
                  <input key={ci} style={{ ...inputStyle, flex: 1 }} value={cell} onChange={(e) => { const rows = compRows.map((r, rx) => rx === ri ? r.map((c, cx) => cx === ci ? e.target.value : c) : r); setCompRows(rows); }} placeholder={compHeaders[ci] || `Col ${ci + 1}`} />
                ))}
                {compRows.length > 1 && <button style={btnSmall} onClick={() => setCompRows(compRows.filter((_, j) => j !== ri))}>✕</button>}
              </div>
            ))}
            <button style={{ ...btnSmall, marginTop: "4px" }} onClick={() => setCompRows([...compRows, compHeaders.map(() => "")])}>+ Row</button>
          </div>
        );

      case "FILL_IN_BLANK":
        return (
          <div>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Sentence * (use ___ for blanks)</label>
              <textarea style={{ ...inputStyle, minHeight: "80px" }} value={cf.fillSentence} onChange={(e) => set({ fillSentence: e.target.value })} placeholder="The ___ is the capital of France." />
              <p style={{ fontSize: "0.7rem", color: "#6b7280", margin: "3px 0 0" }}>Use triple underscores (_&#95;_) to mark each blank position.</p>
            </div>
            <p style={sectionHead}>Accepted Answers per Blank</p>
            {fillBlanks.map((b, i) => (
              <div key={i} style={{ marginBottom: "8px" }}>
                <label style={labelStyle}>Blank {i + 1} — accepted answers (comma-separated)</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={b.accepted} onChange={(e) => { const arr = [...fillBlanks]; arr[i] = { ...arr[i], accepted: e.target.value }; setFillBlanks(arr); }} placeholder="paris, Paris, PARIS" />
                  {fillBlanks.length > 1 && <button style={btnSmall} onClick={() => setFillBlanks(fillBlanks.filter((_, j) => j !== i))}>✕</button>}
                </div>
              </div>
            ))}
            <button style={{ ...btnSmall, marginBottom: "10px" }} onClick={() => setFillBlanks([...fillBlanks, { id: `b${fillBlanks.length + 1}`, accepted: "" }])}>+ Add Blank</button>
            <div>
              <label style={labelStyle}>Explanation (shown after flip)</label>
              <RichTextEditor value={cf.fillExplanation} onChange={(html) => set({ fillExplanation: html })} placeholder="Explain the answer…" minHeight="90px" />
            </div>
          </div>
        );

      case "MATCHING":
        return (
          <div>
            <p style={sectionHead}>Matching Pairs</p>
            {matchPairs.map((pair, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "6px", alignItems: "center" }}>
                <input style={{ ...inputStyle, flex: 1 }} value={pair.left} onChange={(e) => { const arr = [...matchPairs]; arr[i] = { ...arr[i], left: e.target.value }; setMatchPairs(arr); }} placeholder="Left item" />
                <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>↔</span>
                <input style={{ ...inputStyle, flex: 1 }} value={pair.right} onChange={(e) => { const arr = [...matchPairs]; arr[i] = { ...arr[i], right: e.target.value }; setMatchPairs(arr); }} placeholder="Right match" />
                {matchPairs.length > 2 && <button style={btnSmall} onClick={() => setMatchPairs(matchPairs.filter((_, j) => j !== i))}>✕</button>}
              </div>
            ))}
            <button style={{ ...btnSmall, marginBottom: "10px" }} onClick={() => setMatchPairs([...matchPairs, { left: "", right: "" }])}>+ Add Pair</button>
            <div>
              <label style={labelStyle}>Explanation (shown after flip)</label>
              <RichTextEditor value={cf.matchExplanation} onChange={(html) => set({ matchExplanation: html })} placeholder="Explain the correct matching…" minHeight="90px" />
            </div>
          </div>
        );

      case "REORDER":
        return (
          <div>
            <p style={sectionHead}>Items in Correct Order</p>
            <p style={{ fontSize: "0.72rem", color: "#6b7280", margin: "0 0 8px" }}>Enter items in the correct sequence. Students will receive them shuffled.</p>
            {reorderItems.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "5px", alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", color: "#9ca3af", minWidth: "18px" }}>{i + 1}.</span>
                <input style={{ ...inputStyle, flex: 1 }} value={item} onChange={(e) => { const arr = [...reorderItems]; arr[i] = e.target.value; setReorderItems(arr); }} placeholder={`Step ${i + 1}`} />
                <button style={btnSmall} disabled={i === 0} onClick={() => { const arr = [...reorderItems]; [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; setReorderItems(arr); }}>▲</button>
                <button style={btnSmall} disabled={i === reorderItems.length - 1} onClick={() => { const arr = [...reorderItems]; [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; setReorderItems(arr); }}>▼</button>
                {reorderItems.length > 2 && <button style={btnSmall} onClick={() => setReorderItems(reorderItems.filter((_, j) => j !== i))}>✕</button>}
              </div>
            ))}
            <button style={{ ...btnSmall, marginBottom: "10px" }} onClick={() => setReorderItems([...reorderItems, ""])}>+ Add Item</button>
            <div>
              <label style={labelStyle}>Explanation (shown after flip)</label>
              <RichTextEditor value={cf.reorderExplanation} onChange={(html) => set({ reorderExplanation: html })} placeholder="Explain the correct order…" minHeight="90px" />
            </div>
          </div>
        );

      case "CATEGORIZATION":
        return (
          <div>
            <p style={sectionHead}>Categories</p>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
              {catCategories.map((cat, i) => (
                <div key={i} style={{ display: "flex", gap: "4px" }}>
                  <input style={{ ...inputStyle, width: "130px" }} value={cat} onChange={(e) => { const arr = [...catCategories]; arr[i] = e.target.value; setCatCategories(arr); setCatItems(catItems.map((it) => it.category === catCategories[i] ? { ...it, category: e.target.value } : it)); }} />
                  {catCategories.length > 2 && <button style={btnSmall} onClick={() => { const remaining = catCategories.filter((_, j) => j !== i); setCatCategories(remaining); setCatItems(catItems.filter((it) => it.category !== cat)); }}>✕</button>}
                </div>
              ))}
              <button style={btnSmall} onClick={() => setCatCategories([...catCategories, `Category ${catCategories.length + 1}`])}>+ Category</button>
            </div>
            <p style={sectionHead}>Items</p>
            {catItems.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "5px", alignItems: "center" }}>
                <input style={{ ...inputStyle, flex: 1 }} value={item.text} onChange={(e) => { const arr = [...catItems]; arr[i] = { ...arr[i], text: e.target.value }; setCatItems(arr); }} placeholder="Item text" />
                <select style={{ ...inputStyle, width: "130px" }} value={item.category} onChange={(e) => { const arr = [...catItems]; arr[i] = { ...arr[i], category: e.target.value }; setCatItems(arr); }}>
                  {catCategories.filter((c) => c.trim()).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                {catItems.length > 2 && <button style={btnSmall} onClick={() => setCatItems(catItems.filter((_, j) => j !== i))}>✕</button>}
              </div>
            ))}
            <button style={{ ...btnSmall, marginBottom: "10px" }} onClick={() => setCatItems([...catItems, { text: "", category: catCategories[0] || "" }])}>+ Add Item</button>
            <div>
              <label style={labelStyle}>Explanation (shown after flip)</label>
              <RichTextEditor value={cf.catExplanation} onChange={(html) => set({ catExplanation: html })} placeholder="Explain the correct categorization…" minHeight="90px" />
            </div>
          </div>
        );

      default:
        return (
          <div>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Front (question/prompt) *</label>
              <textarea style={{ ...inputStyle, minHeight: "80px" }} value={cf.front} onChange={(e) => set({ front: e.target.value })} />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <label style={labelStyle}>Back (answer/explanation) *</label>
              <textarea style={{ ...inputStyle, minHeight: "80px" }} value={cf.back} onChange={(e) => set({ back: e.target.value })} />
            </div>
          </div>
        );
    }
  };

  return (
    <div style={{ display: "flex", gap: "24px", height: "calc(100vh - 100px)" }}>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, padding: "12px 20px", borderRadius: "8px", zIndex: 9999,
          background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
          color: toast.type === "success" ? "#166534" : "#991b1b",
          boxShadow: "0 4px 12px rgba(0,0,0,.15)", fontWeight: 500, fontSize: "0.875rem",
        }}>{toast.msg}</div>
      )}

      {/* LEFT PANEL */}
      <div style={{ width: "300px", minWidth: "300px", borderRight: "1px solid #e5e7eb", paddingRight: "16px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#111", margin: 0 }}>Flashcard Decks</h1>
          <button style={btnPrimary} onClick={() => { setShowNewDeck(true); setNewDeckForm(emptyDeckForm()); setNewDeckSubjects([]); setNewDeckTopics([]); }}>
            + New
          </button>
        </div>
        <input type="text" placeholder="Search decks…" value={deckSearch}
          onChange={(e) => { setDeckSearch(e.target.value); setDeckPage(1); }}
          style={{ ...inputStyle, marginBottom: "6px" }} />
        <select value={pubFilter} onChange={(e) => { setPubFilter(e.target.value); setDeckPage(1); }}
          style={{ ...inputStyle, marginBottom: "10px" }}>
          <option value="">All</option>
          <option value="true">Published</option>
          <option value="false">Draft</option>
        </select>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loadingDecks ? <p style={{ color: "#9ca3af", padding: "16px", textAlign: "center" }}>Loading…</p>
            : decks.length === 0 ? <p style={{ color: "#9ca3af", padding: "16px", textAlign: "center" }}>No decks found</p>
            : decks.map((d) => (
              <div key={d.id} onClick={() => selectDeck(d)} style={{
                padding: "10px 12px", borderRadius: "6px", cursor: "pointer", marginBottom: "4px",
                background: selectedDeck?.id === d.id ? "#eff6ff" : "transparent",
                border: selectedDeck?.id === d.id ? "1px solid #bfdbfe" : "1px solid transparent",
              }}>
                {d.subjectColor && <div style={{ width: "100%", height: "3px", borderRadius: "2px", background: d.subjectColor, marginBottom: "6px" }} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "#111" }}>{truncate(d.title, 28)}</span>
                  <span style={badge(d.isPublished)}>{d.isPublished ? "Pub" : "Draft"}</span>
                </div>
                {d.subtitle && <p style={{ fontSize: "0.72rem", color: "#6b7280", margin: "2px 0 0" }}>{truncate(d.subtitle, 36)}</p>}
                <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>{d._count?.cards || 0} cards</span>
              </div>
            ))}
        </div>
        {deckTotalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #e5e7eb" }}>
            <button style={btnSmall} disabled={deckPage <= 1} onClick={() => setDeckPage(deckPage - 1)}>Prev</button>
            <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>{deckPage}/{deckTotalPages}</span>
            <button style={btnSmall} disabled={deckPage >= deckTotalPages} onClick={() => setDeckPage(deckPage + 1)}>Next</button>
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!selectedDeck ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af" }}>
            Select a deck or create a new one
          </div>
        ) : (
          <div>
            {/* Deck Header */}
            <div style={{ marginBottom: "20px", padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              {selectedDeck.subjectColor && (
                <div style={{ height: "4px", borderRadius: "2px", background: selectedDeck.subjectColor, marginBottom: "12px" }} />
              )}
              {editingDeck ? (
                <div>
                  <DeckFormFields form={deckForm} setForm={setDeckForm} subjects={deckSubjects} topics={deckTopics} onTaxChange={handleDeckTaxChange} showTemplate examList={exams} />
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button style={btnPrimary} onClick={handleUpdateDeck} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                    <button style={btnSecondary} onClick={() => setEditingDeck(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#111", margin: 0 }}>{selectedDeck.title}</h2>
                      {selectedDeck.subtitle && <p style={{ fontSize: "0.85rem", color: "#4b5563", margin: "3px 0 0" }}>{selectedDeck.subtitle}</p>}
                      {selectedDeck.description && <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "4px 0 0" }}>{selectedDeck.description}</p>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <span style={badge(selectedDeck.isPublished)}>{selectedDeck.isPublished ? "Published" : "Draft"}</span>
                      {selectedDeck.titleTemplate && (
                        <span style={{ fontSize: "0.68rem", color: "#9ca3af" }}>Template: {TITLE_TEMPLATES.find(t => t.id === selectedDeck.titleTemplate)?.label || selectedDeck.titleTemplate}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button style={btnSecondary} onClick={() => { setEditingDeck(true); setDeckForm(deckToForm(selectedDeck)); if (selectedDeck.categoryId) loadTax("subject", selectedDeck.categoryId).then(setDeckSubjects); if (selectedDeck.subjectId) loadTax("topic", selectedDeck.subjectId).then(setDeckTopics); }}>Edit Deck</button>
                    <button style={{ ...btnSecondary, color: selectedDeck.isPublished ? "#92400e" : "#166534" }} onClick={handleTogglePublish} disabled={saving}>
                      {selectedDeck.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    <button style={btnDanger} onClick={handleDeleteDeck} disabled={saving}>Delete</button>
                  </div>
                </div>
              )}
            </div>

            {/* Cards Table */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#111", margin: 0 }}>Cards ({cardTotal})</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  {orderChanged && (
                    <button style={{ ...btnPrimary, background: "#f59e0b" }} onClick={handleSaveOrder} disabled={saving}>
                      {saving ? "Saving…" : "Save Order"}
                    </button>
                  )}
                  <button style={btnPrimary} onClick={() => openCardEditor()}>+ Add Card</button>
                </div>
              </div>
              <input type="text" placeholder="Search cards…" value={cardSearch}
                onChange={(e) => { setCardSearch(e.target.value); setCardPage(1); }}
                style={{ ...inputStyle, marginBottom: "12px", maxWidth: "280px" }} />
              {loadingCards ? (
                <p style={{ color: "#9ca3af", textAlign: "center" }}>Loading cards…</p>
              ) : cards.length === 0 ? (
                <p style={{ color: "#9ca3af", textAlign: "center", padding: "32px" }}>No cards yet. Click "+ Add Card" to create the first card.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                      <th style={{ padding: "8px", width: "36px" }}>#</th>
                      <th style={{ padding: "8px", width: "120px" }}>Type</th>
                      <th style={{ padding: "8px" }}>Content</th>
                      <th style={{ padding: "8px", width: "80px" }}>Subtopic</th>
                      <th style={{ padding: "8px", width: "160px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px", color: "#9ca3af" }}>{i + 1}</td>
                        <td style={{ padding: "8px" }}>
                          <span style={cardTypeBadge(c.cardType)}>{CARD_TYPES.find(t => t.value === c.cardType)?.label || c.cardType}</span>
                        </td>
                        <td style={{ padding: "8px", color: "#374151" }}>
                          {truncate(c.front || (c.content ? JSON.stringify(c.content).slice(0, 40) : ""), 55)}
                        </td>
                        <td style={{ padding: "8px", color: "#6b7280", fontSize: "0.8rem" }}>{c.subtopic?.name || "—"}</td>
                        <td style={{ padding: "8px" }}>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button style={btnSmall} onClick={() => moveCard(i, "up")} disabled={i === 0} title="Move up">▲</button>
                            <button style={btnSmall} onClick={() => moveCard(i, "down")} disabled={i === cards.length - 1} title="Move down">▼</button>
                            <button style={{ ...btnSmall, color: "#2563eb" }} onClick={() => openCardEditor(c)}>Edit</button>
                            <button style={{ ...btnSmall, color: "#ef4444" }} onClick={() => handleDeleteCard(c.id)}>Del</button>
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "520px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 16px" }}>New Deck</h3>
            <DeckFormFields form={newDeckForm} setForm={setNewDeckForm} subjects={newDeckSubjects} topics={newDeckTopics} onTaxChange={handleNewDeckTaxChange} showTemplate examList={exams} />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button style={btnSecondary} onClick={() => setShowNewDeck(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleCreateDeck} disabled={saving}>{saving ? "Creating…" : "Create Deck"}</button>
            </div>
          </div>
        </div>
      )}

      {/* CARD EDITOR MODAL */}
      {showCardModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: "24px 16px", overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "620px", maxWidth: "100%", maxHeight: "calc(100vh - 48px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>{editingCard ? "Edit Card" : "Add Card"}</h3>
              <button style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#9ca3af" }} onClick={() => setShowCardModal(false)}>✕</button>
            </div>

            {/* Card type selector */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Card Type</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {CARD_TYPES.map((ct) => (
                  <button key={ct.value} onClick={() => setCardForm((f) => ({ ...f, cardType: ct.value }))} style={{
                    padding: "8px 12px", borderRadius: "6px", cursor: "pointer", textAlign: "left",
                    border: cardForm.cardType === ct.value ? `2px solid ${selectedDeck?.subjectColor || "#7c3aed"}` : "1px solid #e5e7eb",
                    background: cardForm.cardType === ct.value ? "#faf5ff" : "#fff",
                    color: cardForm.cardType === ct.value ? "#5b21b6" : "#374151",
                  }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{ct.label}</div>
                    <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{ct.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic card type fields */}
            <CardTypeFormFields />

            {/* Taxonomy */}
            <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #f3f4f6" }}>
              <label style={{ ...labelStyle, marginBottom: "8px" }}>Subtopic Taxonomy (optional)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <div>
                  <label style={{ fontSize: "0.68rem", color: "#6b7280" }}>Category</label>
                  <select style={inputStyle} value={cardForm.categoryId} onChange={(e) => handleCardTaxChange("category", e.target.value)}>
                    <option value="">None</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.68rem", color: "#6b7280" }}>Subject</label>
                  <select style={inputStyle} value={cardForm.subjectId} onChange={(e) => handleCardTaxChange("subject", e.target.value)} disabled={!cardForm.categoryId}>
                    <option value="">None</option>
                    {cardSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.68rem", color: "#6b7280" }}>Topic</label>
                  <select style={inputStyle} value={cardForm.topicId} onChange={(e) => handleCardTaxChange("topic", e.target.value)} disabled={!cardForm.subjectId}>
                    <option value="">None</option>
                    {cardTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.68rem", color: "#6b7280" }}>Subtopic</label>
                  <select style={inputStyle} value={cardForm.subtopicId} onChange={(e) => handleCardTaxChange("subtopic", e.target.value)} disabled={!cardForm.topicId}>
                    <option value="">None</option>
                    {cardSubtopics.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button style={btnSecondary} onClick={() => setShowCardModal(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleSaveCard} disabled={saving}>{saving ? "Saving…" : editingCard ? "Update Card" : "Add Card"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
