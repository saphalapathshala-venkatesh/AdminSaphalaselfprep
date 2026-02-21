import { createHash } from "crypto";

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\r\n]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

export function computeContentHash(
  stem: string,
  options: { text: string }[],
  type: string
): string {
  const normalizedStem = normalizeText(stem);
  const normalizedOptions = options
    .map((o) => normalizeText(o.text))
    .sort()
    .join("|");
  const raw = `${type}::${normalizedStem}::${normalizedOptions}`;
  return createHash("sha256").update(raw).digest("hex");
}

export function computeSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;

  const wordsA = na.split(" ");
  const wordsB = nb.split(" ");
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  let intersection = 0;
  setA.forEach((w) => {
    if (setB.has(w)) intersection++;
  });
  const union = new Set(wordsA.concat(wordsB)).size;
  return union === 0 ? 0 : intersection / union;
}
