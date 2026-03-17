"use client";

import React, { useState, useEffect, useCallback } from "react";
import BlockRenderer from "@/components/ui/BlockRenderer";
import { isBlockDoc } from "@/lib/blocks/schema";

interface FlashcardCard {
  id: string;
  cardType: string;
  front: string;
  back: string;
  imageUrl: string | null;
  order: number;
  content: Record<string, unknown> | null;
}

interface FlashcardDeck {
  id: string;
  title: string;
  subtitle: string | null;
  subjectColor: string | null;
  titleTemplate: string | null;
  titleImageUrl: string | null;
}

interface FlashcardPlayerProps {
  deckId: string;
  onComplete?: () => void;
  onExit?: () => void;
  subjectColor?: string;
}

const LOGO_SVG = (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="#7c3aed" />
    <text x="16" y="22" fontSize="16" fontWeight="800" fill="white" textAnchor="middle" fontFamily="Arial, sans-serif">S</text>
  </svg>
);

export default function FlashcardPlayer({ deckId, onComplete, onExit, subjectColor }: FlashcardPlayerProps) {
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [allCards, setAllCards] = useState<FlashcardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [fillInput, setFillInput] = useState("");
  const [fillSubmitted, setFillSubmitted] = useState(false);
  const [fillCorrect, setFillCorrect] = useState(false);
  const [matchAnswers, setMatchAnswers] = useState<Record<string, string>>({});
  const [matchSubmitted, setMatchSubmitted] = useState(false);
  const [reorderList, setReorderList] = useState<string[]>([]);
  const [reorderSubmitted, setReorderSubmitted] = useState(false);
  const [catAssignments, setCatAssignments] = useState<Record<string, string>>({});
  const [catSubmitted, setCatSubmitted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);

  const accent = subjectColor || deck?.subjectColor || "#7c3aed";

  useEffect(() => {
    fetch(`/api/flashcards/decks/${deckId}/cards?pageSize=100`)
      .then(r => r.json())
      .then(d => {
        setDeck(d.deck || null);
        const fetchedCards: FlashcardCard[] = d.items || [];
        setAllCards(fetchedCards);
        if (fetchedCards.length > 0) {
          const first = fetchedCards[0];
          if (first.cardType === "REORDER" && first.content) {
            const reorderItems = (first.content as Record<string, unknown[]>).reorderItems as string[] || [];
            setReorderList([...reorderItems].sort(() => Math.random() - 0.5));
          }
        }
      })
      .catch(() => setError("Failed to load flashcard deck."))
      .finally(() => setLoading(false));
  }, [deckId]);

  const cards = allCards;
  const card = cards[currentIndex];
  const isLast = currentIndex === cards.length - 1;

  const resetCardState = useCallback((nextCard: FlashcardCard) => {
    setFlipped(false);
    setQuizSelected(null);
    setQuizSubmitted(false);
    setFillInput("");
    setFillSubmitted(false);
    setFillCorrect(false);
    setMatchAnswers({});
    setMatchSubmitted(false);
    setCatAssignments({});
    setCatSubmitted(false);
    if (nextCard?.cardType === "REORDER" && nextCard.content) {
      const items = (nextCard.content as Record<string, unknown[]>).reorderItems as string[] || [];
      setReorderList([...items].sort(() => Math.random() - 0.5));
    } else {
      setReorderList([]);
    }
    setReorderSubmitted(false);
  }, []);

  const goNext = useCallback(() => {
    if (isLast) {
      setCompleted(true);
      onComplete?.();
      return;
    }
    const next = cards[currentIndex + 1];
    setCurrentIndex(i => i + 1);
    resetCardState(next);
  }, [isLast, cards, currentIndex, resetCardState, onComplete]);

  const goPrev = useCallback(() => {
    if (currentIndex === 0) return;
    const prev = cards[currentIndex - 1];
    setCurrentIndex(i => i - 1);
    resetCardState(prev);
  }, [currentIndex, cards, resetCardState]);

  // Anti-copy deterrents
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
    };
  }, []);

  const logInfringement = useCallback(async (eventType: string) => {
    if (!deck) return;
    try {
      const res = await fetch("/api/infringement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "flashcard_deck", contentId: deck.id, eventType }),
      });
      const data = await res.json();
      if (data.actionTaken === "WARNING_1") setSessionWarning("⚠️ Warning 1: Copying or recording this content is not permitted. Your activity is monitored.");
      else if (data.actionTaken === "WARNING_2") setSessionWarning("⚠️ Warning 2: This is your second violation. One more will result in account suspension.");
      else if (data.actionTaken === "AUTO_BLOCKED") setSessionWarning("🚫 Your account has been suspended due to repeated policy violations. Please contact support.");
    } catch { }
  }, [deck]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "a", "s", "u", "p"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        logInfringement("KEYBOARD_COPY_ATTEMPT");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [logInfringement]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
      <div style={{ textAlign: "center" }}>
        {LOGO_SVG}
        <p style={{ marginTop: 12, color: "#6b7280", fontSize: "0.875rem" }}>Loading deck…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: "center", padding: 40, color: "#ef4444" }}>{error}</div>
  );

  if (!deck || cards.length === 0) return (
    <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>This deck has no cards yet.</div>
  );

  if (completed) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16 }}>
      <div style={{ fontSize: "3rem" }}>🎉</div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: accent }}>Deck Complete!</h2>
      <p style={{ color: "#6b7280" }}>You've reviewed all {cards.length} cards in this deck.</p>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={() => { setCurrentIndex(0); resetCardState(cards[0]); setCompleted(false); }}
          style={{ padding: "10px 24px", background: accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          Review Again
        </button>
        {onExit && (
          <button onClick={onExit}
            style={{ padding: "10px 24px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
            Back to Lesson
          </button>
        )}
      </div>
    </div>
  );

  const content = card.content as Record<string, unknown> | null;

  const renderCardContent = () => {
    switch (card.cardType) {
      case "TITLE":
        return <TitleCard card={card} content={content} accent={accent} deck={deck} />;
      case "INFO":
        return <InfoCard card={card} content={content} accent={accent} flipped={flipped} onFlip={() => setFlipped(f => !f)} />;
      case "QUIZ":
        return <QuizCard card={card} content={content} accent={accent} flipped={flipped} onFlip={() => setFlipped(f => !f)}
          selected={quizSelected} onSelect={setQuizSelected} submitted={quizSubmitted} onSubmit={() => setQuizSubmitted(true)} />;
      case "COMPARISON":
        return <ComparisonCard content={content} accent={accent} />;
      case "FILL_IN_BLANK":
        return <FillCard card={card} content={content} accent={accent} flipped={flipped} onFlip={() => setFlipped(f => !f)}
          input={fillInput} onInput={setFillInput} submitted={fillSubmitted} correct={fillCorrect}
          onSubmit={() => {
            if (!content) return;
            const blanks = (content.fillBlanks as Array<{ accepted: string }>) || [];
            const accepted = (blanks[0]?.accepted || "").split(",").map((s: string) => s.trim().toLowerCase());
            const answer = fillInput.trim().toLowerCase().replace(/\s+/g, " ");
            setFillCorrect(accepted.includes(answer));
            setFillSubmitted(true);
          }} />;
      case "MATCHING":
        return <MatchingCard content={content} accent={accent} flipped={flipped} onFlip={() => setFlipped(f => !f)}
          answers={matchAnswers} onAnswer={setMatchAnswers} submitted={matchSubmitted} onSubmit={() => setMatchSubmitted(true)} />;
      case "REORDER":
        return <ReorderCard content={content} accent={accent} flipped={flipped} onFlip={() => setFlipped(f => !f)}
          list={reorderList} onReorder={setReorderList} submitted={reorderSubmitted} onSubmit={() => setReorderSubmitted(true)} />;
      case "CATEGORIZATION":
        return <CategorizationCard content={content} accent={accent} flipped={flipped} onFlip={() => setFlipped(f => !f)}
          assignments={catAssignments} onAssign={setCatAssignments} submitted={catSubmitted} onSubmit={() => setCatSubmitted(true)} />;
      default:
        return <DefaultCard card={card} flipped={flipped} onFlip={() => setFlipped(f => !f)} accent={accent} />;
    }
  };

  const canGoNext = card.cardType === "TITLE" || card.cardType === "INFO" || card.cardType === "COMPARISON"
    || (card.cardType === "QUIZ" && flipped)
    || (card.cardType === "FILL_IN_BLANK" && fillSubmitted)
    || (card.cardType === "MATCHING" && matchSubmitted)
    || (card.cardType === "REORDER" && reorderSubmitted)
    || (card.cardType === "CATEGORIZATION" && catSubmitted);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", userSelect: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => { e.preventDefault(); logInfringement("RIGHT_CLICK_ATTEMPT"); }}>
      {/* Brand Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: "1px solid #f3f4f6", background: "#fff" }}>
        {LOGO_SVG}
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1f2937", lineHeight: 1.2 }}>Saphala Pathshala</div>
          <div style={{ fontSize: "0.65rem", color: "#6b7280", lineHeight: 1.2 }}>Your Success is Our Focus</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
          {currentIndex + 1} / {cards.length}
        </div>
        {onExit && (
          <button onClick={onExit} style={{ padding: "4px 12px", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.75rem", color: "#6b7280" }}>
            Exit
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "#f3f4f6" }}>
        <div style={{ height: 3, background: accent, width: `${((currentIndex + 1) / cards.length) * 100}%`, transition: "width 0.3s" }} />
      </div>

      {/* Warning banner */}
      {sessionWarning && (
        <div style={{ background: "#fef3c7", borderBottom: "1px solid #fde68a", padding: "8px 16px", fontSize: "0.8rem", color: "#92400e", fontWeight: 500 }}>
          {sessionWarning}
          <button onClick={() => setSessionWarning(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "#92400e" }}>✕</button>
        </div>
      )}

      {/* Card area */}
      <div style={{ padding: "24px 20px", minHeight: 420, display: "flex", flexDirection: "column" }}>
        {/* Deck breadcrumb */}
        <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: 16, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {deck.title}{card.cardType !== "TITLE" ? ` · Card ${currentIndex + 1}` : ""}
        </div>

        {/* Card content */}
        <div style={{ flex: 1 }}>
          {renderCardContent()}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "1px solid #f3f4f6" }}>
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            style={{ padding: "8px 20px", background: currentIndex === 0 ? "#f3f4f6" : "#fff", border: "1px solid #e5e7eb", borderRadius: 8, cursor: currentIndex === 0 ? "default" : "pointer", color: currentIndex === 0 ? "#9ca3af" : "#374151", fontWeight: 500, fontSize: "0.875rem" }}>
            ← Previous
          </button>
          <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
            {currentIndex + 1} of {cards.length}
          </div>
          <button
            onClick={goNext}
            disabled={!canGoNext}
            style={{ padding: "8px 20px", background: canGoNext ? accent : "#f3f4f6", border: "none", borderRadius: 8, cursor: canGoNext ? "pointer" : "default", color: canGoNext ? "#fff" : "#9ca3af", fontWeight: 600, fontSize: "0.875rem", transition: "background 0.2s" }}>
            {isLast ? "Complete ✓" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card Type Components ─────────────────────────────────────────────────────

function BrandedCardShell({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `2px solid ${accent}20`, borderTop: `4px solid ${accent}`, borderRadius: 12, background: "#fff", padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
      {children}
    </div>
  );
}

function RichContent({ html }: { html: string }) {
  return <div style={{ lineHeight: 1.7, fontSize: "0.9rem", color: "#1f2937" }} dangerouslySetInnerHTML={{ __html: html || "" }} />;
}

function TitleCard({ card, content, accent, deck }: { card: FlashcardCard; content: Record<string, unknown> | null; accent: string; deck: FlashcardDeck }) {
  const title = (content?.titleTitle as string) || deck.title;
  const subtitle = (content?.titleSubtitle as string) || deck.subtitle || "";
  const imageUrl = (content?.titleImageUrl as string) || deck.titleImageUrl || "";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, textAlign: "center", gap: 16, padding: "20px 0" }}>
      {imageUrl && <img src={imageUrl} alt="Title" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 12, objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
      <div style={{ width: 48, height: 4, background: accent, borderRadius: 2 }} />
      <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: accent, margin: 0, lineHeight: 1.2 }}>{title}</h2>
      {subtitle && <p style={{ color: "#6b7280", fontSize: "1rem", margin: 0 }}>{subtitle}</p>}
      <p style={{ color: "#9ca3af", fontSize: "0.78rem" }}>Press Next to begin →</p>
    </div>
  );
}

function InfoCard({ card, content, accent, flipped, onFlip }: { card: FlashcardCard; content: Record<string, unknown> | null; accent: string; flipped: boolean; onFlip: () => void }) {
  const title = (content?.infoTitle as string) || "";
  const bodyBlocks = content?.bodyBlocks;
  const body = (content?.infoBody as string) || card.front || "";
  const keyPoints = (content?.keyPoints as string[]) || [];
  const exampleBlocks = content?.exampleBlocks;
  const example = (content?.infoExample as string) || "";
  const imageUrl = (content?.imageUrl as string) || card.imageUrl || "";

  const hasExampleBlocks = isBlockDoc(exampleBlocks) && exampleBlocks.blocks.length > 0;
  const hasExampleHtml = !hasExampleBlocks && !!example;

  return (
    <BrandedCardShell accent={accent}>
      {title && <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: accent, margin: "0 0 12px" }}>{title}</h3>}
      {isBlockDoc(bodyBlocks) ? (
        <BlockRenderer doc={bodyBlocks} compact />
      ) : (
        <RichContent html={body} />
      )}
      {keyPoints.filter(Boolean).length > 0 && (
        <div style={{ marginTop: 14, padding: "10px 14px", background: `${accent}08`, borderRadius: 8 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Key Points</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {keyPoints.filter(Boolean).map((p, i) => <li key={i} style={{ fontSize: "0.875rem", color: "#374151", marginBottom: 4 }}>{p}</li>)}
          </ul>
        </div>
      )}
      {(hasExampleBlocks || hasExampleHtml) && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#15803d", marginBottom: 4 }}>Example</div>
          {hasExampleBlocks ? (
            <BlockRenderer doc={exampleBlocks as any} compact />
          ) : (
            <RichContent html={example} />
          )}
        </div>
      )}
      {imageUrl && <img src={imageUrl} alt="Info" style={{ marginTop: 12, maxWidth: "100%", maxHeight: 180, borderRadius: 8, objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
      {!flipped && card.back && (
        <button onClick={onFlip} style={{ marginTop: 16, padding: "8px 20px", background: accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>
          Show More ↓
        </button>
      )}
      {flipped && card.back && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <RichContent html={card.back} />
        </div>
      )}
    </BrandedCardShell>
  );
}

function QuizCard({ card, content, accent, flipped, onFlip, selected, onSelect, submitted, onSubmit }: {
  card: FlashcardCard; content: Record<string, unknown> | null; accent: string; flipped: boolean; onFlip: () => void;
  selected: number | null; onSelect: (i: number) => void; submitted: boolean; onSubmit: () => void;
}) {
  const question = (content?.quizQuestion as string) || card.front || "";
  const options = (content?.quizOptions as Array<{ text: string; isCorrect: boolean }>) || [];
  const explanation = (content?.quizExplanation as string) || card.back || "";

  return (
    <BrandedCardShell accent={accent}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Quiz</div>
      <RichContent html={question} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        {options.map((opt, i) => {
          let bg = "#f8fafc", border = "#e2e8f0", color = "#1f2937";
          if (submitted) {
            if (opt.isCorrect) { bg = "#dcfce7"; border = "#86efac"; color = "#15803d"; }
            else if (selected === i && !opt.isCorrect) { bg = "#fee2e2"; border = "#fca5a5"; color = "#991b1b"; }
          } else if (selected === i) { bg = `${accent}12`; border = accent; color = accent; }
          return (
            <button key={i} onClick={() => { if (!submitted) onSelect(i); }}
              style={{ padding: "10px 14px", background: bg, border: `1.5px solid ${border}`, borderRadius: 8, cursor: submitted ? "default" : "pointer", textAlign: "left", color, fontWeight: selected === i ? 600 : 400, fontSize: "0.875rem", transition: "all 0.15s" }}>
              <span style={{ fontWeight: 700, marginRight: 8 }}>{String.fromCharCode(65 + i)}.</span>
              {opt.text}
            </button>
          );
        })}
      </div>
      {!submitted && selected !== null && (
        <button onClick={onSubmit} style={{ marginTop: 14, padding: "9px 22px", background: accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          Submit Answer
        </button>
      )}
      {submitted && !flipped && (
        <button onClick={onFlip} style={{ marginTop: 14, padding: "9px 22px", background: "#1f2937", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          Flip Card →
        </button>
      )}
      {submitted && flipped && explanation && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#b45309", marginBottom: 6 }}>Explanation</div>
          <RichContent html={explanation} />
        </div>
      )}
    </BrandedCardShell>
  );
}

function ComparisonCard({ content, accent }: { content: Record<string, unknown> | null; accent: string }) {
  const title = (content?.compTitle as string) || "";
  const headers = (content?.compHeaders as string[]) || [];
  const rows = (content?.compRows as string[][]) || [];
  return (
    <BrandedCardShell accent={accent}>
      {title && <h3 style={{ fontSize: "1rem", fontWeight: 700, color: accent, margin: "0 0 14px" }}>{title}</h3>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          {headers.length > 0 && (
            <thead>
              <tr>
                {headers.map((h, i) => <th key={i} style={{ padding: "8px 12px", background: `${accent}15`, color: accent, fontWeight: 700, textAlign: "left", border: "1.5px solid #e5e7eb" }}>{h}</th>)}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#f8fafc" }}>
                {row.map((cell, ci) => <td key={ci} style={{ padding: "7px 12px", border: "1.5px solid #e5e7eb", color: "#374151" }}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BrandedCardShell>
  );
}

function FillCard({ card, content, accent, flipped, onFlip, input, onInput, submitted, correct, onSubmit }: {
  card: FlashcardCard; content: Record<string, unknown> | null; accent: string; flipped: boolean; onFlip: () => void;
  input: string; onInput: (v: string) => void; submitted: boolean; correct: boolean; onSubmit: () => void;
}) {
  const sentence = (content?.fillSentence as string) || card.front || "";
  const explanation = (content?.fillExplanation as string) || card.back || "";
  return (
    <BrandedCardShell accent={accent}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Fill in the Blank</div>
      <RichContent html={sentence} />
      <div style={{ marginTop: 16 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => { if (!submitted) onInput(e.target.value); }}
          placeholder="Type your answer…"
          style={{ width: "100%", padding: "10px 14px", border: `2px solid ${submitted ? (correct ? "#86efac" : "#fca5a5") : "#e5e7eb"}`, borderRadius: 8, fontSize: "0.95rem", outline: "none", background: submitted ? (correct ? "#dcfce7" : "#fee2e2") : "#fff" }}
        />
        {submitted && (
          <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: correct ? "#15803d" : "#991b1b", fontWeight: 600 }}>
            {correct ? "✓ Correct!" : "✗ Not quite right."}
          </p>
        )}
      </div>
      {!submitted && (
        <button onClick={onSubmit} disabled={!input.trim()}
          style={{ marginTop: 14, padding: "9px 22px", background: input.trim() ? accent : "#e5e7eb", color: input.trim() ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, fontWeight: 600, cursor: input.trim() ? "pointer" : "default" }}>
          Submit Answer
        </button>
      )}
      {submitted && !correct && (
        <button onClick={() => { onInput(""); }} style={{ marginTop: 8, padding: "7px 18px", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: "0.875rem" }}>
          Try Again
        </button>
      )}
      {submitted && !flipped && (
        <button onClick={onFlip} style={{ marginTop: 10, padding: "9px 22px", background: "#1f2937", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", display: "block" }}>
          Flip Card →
        </button>
      )}
      {submitted && flipped && explanation && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#b45309", marginBottom: 6 }}>Explanation</div>
          <RichContent html={explanation} />
        </div>
      )}
    </BrandedCardShell>
  );
}

function MatchingCard({ content, accent, flipped, onFlip, answers, onAnswer, submitted, onSubmit }: {
  content: Record<string, unknown> | null; accent: string; flipped: boolean; onFlip: () => void;
  answers: Record<string, string>; onAnswer: (a: Record<string, string>) => void; submitted: boolean; onSubmit: () => void;
}) {
  const pairs = (content?.matchPairs as Array<{ left: string; right: string }>) || [];
  const explanation = (content?.matchExplanation as string) || "";
  const rights = [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5);

  return (
    <BrandedCardShell accent={accent}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Matching</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pairs.map((pair, i) => {
          const isCorrect = submitted && answers[pair.left] === pair.right;
          const isWrong = submitted && answers[pair.left] !== undefined && answers[pair.left] !== pair.right;
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1, padding: "8px 12px", background: "#f8fafc", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: "0.875rem", fontWeight: 500 }}>{pair.left}</div>
              <span style={{ color: "#9ca3af" }}>→</span>
              <select
                value={answers[pair.left] || ""}
                onChange={(e) => { if (!submitted) onAnswer({ ...answers, [pair.left]: e.target.value }); }}
                style={{ flex: 1, padding: "8px 10px", border: `1.5px solid ${isCorrect ? "#86efac" : isWrong ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 8, fontSize: "0.875rem", background: isCorrect ? "#dcfce7" : isWrong ? "#fee2e2" : "#fff" }}>
                <option value="">Select…</option>
                {rights.map((r, j) => <option key={j} value={r}>{r}</option>)}
              </select>
            </div>
          );
        })}
      </div>
      {!submitted && (
        <button onClick={onSubmit} disabled={Object.keys(answers).length < pairs.length}
          style={{ marginTop: 14, padding: "9px 22px", background: Object.keys(answers).length >= pairs.length ? accent : "#e5e7eb", color: Object.keys(answers).length >= pairs.length ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          Submit
        </button>
      )}
      {submitted && !flipped && (
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={() => { onAnswer({}); }} style={{ padding: "7px 16px", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: "0.875rem" }}>Retry</button>
          <button onClick={onFlip} style={{ padding: "7px 16px", background: "#1f2937", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>Flip Card →</button>
        </div>
      )}
      {submitted && flipped && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#374151", marginBottom: 6 }}>Correct Answers:</div>
          {pairs.map((p, i) => <div key={i} style={{ fontSize: "0.8rem", color: "#15803d", marginBottom: 3 }}>{p.left} → {p.right}</div>)}
          {explanation && <div style={{ marginTop: 12, padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}><RichContent html={explanation} /></div>}
        </div>
      )}
    </BrandedCardShell>
  );
}

function ReorderCard({ content, accent, flipped, onFlip, list, onReorder, submitted, onSubmit }: {
  content: Record<string, unknown> | null; accent: string; flipped: boolean; onFlip: () => void;
  list: string[]; onReorder: (l: string[]) => void; submitted: boolean; onSubmit: () => void;
}) {
  const correct = (content?.reorderItems as string[]) || [];
  const explanation = (content?.reorderExplanation as string) || "";

  const move = (from: number, to: number) => {
    if (submitted) return;
    const arr = [...list];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    onReorder(arr);
  };

  return (
    <BrandedCardShell accent={accent}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Arrange in Order</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {list.map((item, i) => {
          const isCorrect = submitted && correct[i] === item;
          const isWrong = submitted && correct[i] !== item;
          return (
            <div key={item} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#9ca3af", fontSize: "0.75rem", minWidth: 20 }}>{i + 1}.</span>
              <div style={{ flex: 1, padding: "8px 12px", background: isCorrect ? "#dcfce7" : isWrong ? "#fee2e2" : "#f8fafc", border: `1.5px solid ${isCorrect ? "#86efac" : isWrong ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 8, fontSize: "0.875rem" }}>{item}</div>
              {!submitted && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button onClick={() => move(i, i - 1)} disabled={i === 0} style={{ padding: "2px 7px", fontSize: "0.7rem", border: "1px solid #e5e7eb", borderRadius: 4, cursor: i === 0 ? "default" : "pointer", background: "#fff" }}>▲</button>
                  <button onClick={() => move(i, i + 1)} disabled={i === list.length - 1} style={{ padding: "2px 7px", fontSize: "0.7rem", border: "1px solid #e5e7eb", borderRadius: 4, cursor: i === list.length - 1 ? "default" : "pointer", background: "#fff" }}>▼</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!submitted && (
        <button onClick={onSubmit} style={{ marginTop: 14, padding: "9px 22px", background: accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Submit</button>
      )}
      {submitted && !flipped && (
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={() => { onReorder([...list].sort(() => Math.random() - 0.5)); }} style={{ padding: "7px 16px", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: "0.875rem" }}>Retry</button>
          <button onClick={onFlip} style={{ padding: "7px 16px", background: "#1f2937", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>Flip Card →</button>
        </div>
      )}
      {submitted && flipped && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#374151", marginBottom: 6 }}>Correct Order:</div>
          {correct.map((c, i) => <div key={i} style={{ fontSize: "0.8rem", color: "#15803d", marginBottom: 3 }}>{i + 1}. {c}</div>)}
          {explanation && <div style={{ marginTop: 12, padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}><RichContent html={explanation} /></div>}
        </div>
      )}
    </BrandedCardShell>
  );
}

function CategorizationCard({ content, accent, flipped, onFlip, assignments, onAssign, submitted, onSubmit }: {
  content: Record<string, unknown> | null; accent: string; flipped: boolean; onFlip: () => void;
  assignments: Record<string, string>; onAssign: (a: Record<string, string>) => void; submitted: boolean; onSubmit: () => void;
}) {
  const categories = (content?.catCategories as string[]) || [];
  const items = (content?.catItems as Array<{ text: string; category: string }>) || [];
  const explanation = (content?.catExplanation as string) || "";

  return (
    <BrandedCardShell accent={accent}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Categorize Each Item</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => {
          const isCorrect = submitted && assignments[item.text] === item.category;
          const isWrong = submitted && assignments[item.text] !== item.category;
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1, padding: "7px 11px", background: "#f8fafc", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: "0.875rem" }}>{item.text}</div>
              <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>→</span>
              <select
                value={assignments[item.text] || ""}
                onChange={(e) => { if (!submitted) onAssign({ ...assignments, [item.text]: e.target.value }); }}
                style={{ flex: 1, padding: "7px 10px", border: `1.5px solid ${isCorrect ? "#86efac" : isWrong ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 8, fontSize: "0.875rem", background: isCorrect ? "#dcfce7" : isWrong ? "#fee2e2" : "#fff" }}>
                <option value="">Category…</option>
                {categories.map((c, j) => <option key={j} value={c}>{c}</option>)}
              </select>
            </div>
          );
        })}
      </div>
      {!submitted && (
        <button onClick={onSubmit} disabled={Object.keys(assignments).length < items.length}
          style={{ marginTop: 14, padding: "9px 22px", background: Object.keys(assignments).length >= items.length ? accent : "#e5e7eb", color: Object.keys(assignments).length >= items.length ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          Submit
        </button>
      )}
      {submitted && !flipped && (
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={() => { onAssign({}); }} style={{ padding: "7px 16px", background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: "0.875rem" }}>Retry</button>
          <button onClick={onFlip} style={{ padding: "7px 16px", background: "#1f2937", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>Flip Card →</button>
        </div>
      )}
      {submitted && flipped && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#374151", marginBottom: 6 }}>Correct Categorization:</div>
          {items.map((it, i) => <div key={i} style={{ fontSize: "0.8rem", color: "#15803d", marginBottom: 3 }}>{it.text} → {it.category}</div>)}
          {explanation && <div style={{ marginTop: 12, padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}><RichContent html={explanation} /></div>}
        </div>
      )}
    </BrandedCardShell>
  );
}

function DefaultCard({ card, flipped, onFlip, accent }: { card: FlashcardCard; flipped: boolean; onFlip: () => void; accent: string }) {
  return (
    <BrandedCardShell accent={accent}>
      <div style={{ marginBottom: flipped ? 16 : 0 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Question</div>
        <RichContent html={card.front} />
      </div>
      {!flipped && (
        <button onClick={onFlip} style={{ marginTop: 16, padding: "9px 22px", background: accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Flip Card →</button>
      )}
      {flipped && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1.5px dashed #e5e7eb" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", marginBottom: 8 }}>Answer</div>
          <RichContent html={card.back} />
        </div>
      )}
    </BrandedCardShell>
  );
}
