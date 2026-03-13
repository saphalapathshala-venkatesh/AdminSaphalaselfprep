export const SUBJECT_COLORS: Record<string, string> = {
  "Polity":                   "#8050C0",
  "History":                  "#8B5E3C",
  "Geography":                "#2E8B57",
  "Economy":                  "#2563EB",
  "Environment & Ecology":    "#0F766E",
  "General Science":          "#10B981",
  "Science & Technology":     "#0891B2",
  "Current Affairs":          "#F97316",
  "Reasoning":                "#4F46E5",
  "Quant":                    "#1D4ED8",
  "English":                  "#7C2D12",
};

export const DEFAULT_SUBJECT_COLOR = "#7c3aed";

export const SUBJECT_COLOR_LIST = Object.entries(SUBJECT_COLORS).map(([name, hex]) => ({ name, hex }));

export function getSubjectColor(subjectName?: string | null, override?: string | null): string {
  if (override) return override;
  if (!subjectName) return DEFAULT_SUBJECT_COLOR;
  return SUBJECT_COLORS[subjectName] ?? DEFAULT_SUBJECT_COLOR;
}
