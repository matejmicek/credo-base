export function sanitizeCitations(input?: string | null): string | null {
  if (input == null) return input ?? null;

  let text = String(input);

  // Remove Private Use Area characters often used as citation markers
  text = text.replace(/[\uE000-\uF8FF]/g, "");

  // Remove common tool artifacts like turnXsearchY / turnXnewsY
  text = text.replace(/\bturn\d+(?:search|news)\d+\b/gi, "");

  // Remove plain 'cite'/'citation' tokens
  text = text.replace(/\b(?:cite|citation|citations)\b/gi, "");

  // Remove bracketed numeric refs like [1], [2-4]
  text = text.replace(/\[(?:\d+(?:-\d+)?)\]/g, "");

  // Collapse excess whitespace
  text = text.replace(/\s{2,}/g, " ").trim();

  return text.length > 0 ? text : null;
}

export enum CompetitorCategory {
  EARLY_STAGE = "early-stage",
  WELL_FUNDED = "well-funded",
  INCUMBENT = "incumbent",
}

export const ALL_COMPETITOR_CATEGORIES: CompetitorCategory[] = [
  CompetitorCategory.EARLY_STAGE,
  CompetitorCategory.WELL_FUNDED,
  CompetitorCategory.INCUMBENT,
];


