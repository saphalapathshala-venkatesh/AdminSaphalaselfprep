export interface TitleTemplate {
  id: string;
  label: string;
  description: string;
}

export const TITLE_TEMPLATES: TitleTemplate[] = [
  { id: "minimal_academic",    label: "Minimal Academic",    description: "Clean white, centered title, subject accent bar" },
  { id: "image_right",         label: "Image Right",         description: "Title left, illustration right panel" },
  { id: "light_overlay",       label: "Light Overlay",       description: "Full-width image with text overlay" },
  { id: "icon_focus",          label: "Icon Focus",          description: "Large subject icon above title" },
  { id: "quote_style",         label: "Quote Style",         description: "Subtitle shown as an opening quote" },
  { id: "chapter_opener",      label: "Chapter Opener",      description: "Chapter number + title, editorial feel" },
  { id: "badge_style",         label: "Badge Style",         description: "Subject badge + bold title block" },
  { id: "diagram_cover",       label: "Diagram Cover",       description: "Space reserved for diagram/mind-map image" },
  { id: "timeline_opener",     label: "Timeline Opener",     description: "Timeline bar with title for sequence decks" },
  { id: "premium_editorial",   label: "Premium Editorial",   description: "Two-tone split layout, bold typography" },
];

export function getTemplate(id: string): TitleTemplate {
  return TITLE_TEMPLATES.find((t) => t.id === id) ?? TITLE_TEMPLATES[0];
}
