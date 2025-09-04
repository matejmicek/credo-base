export enum CompetitorType {
  YC_COMPANIES = "yc-companies",
  OPEN_SOURCE = "open-source",
  EARLY_STAGE_VC = "early-stage-vc", 
  WELL_FUNDED_VC = "well-funded-vc",
  INCUMBENTS = "incumbents"
}

export interface CompetitorTypeConfig {
  slug: CompetitorType;
  name: string;
  description: string;
}

export const COMPETITOR_TYPE_CONFIGS: Record<CompetitorType, CompetitorTypeConfig> = {
  [CompetitorType.YC_COMPANIES]: {
    slug: CompetitorType.YC_COMPANIES,
    name: "Y Combinator Companies",
    description: "Current or former Y Combinator portfolio companies operating in the same or adjacent space, typically early to growth stage startups with YC backing"
  },
  [CompetitorType.OPEN_SOURCE]: {
    slug: CompetitorType.OPEN_SOURCE,
    name: "Open Source Solutions", 
    description: "Open source projects, tools, libraries, or platforms that provide similar functionality or solve similar problems, regardless of commercial backing"
  },
  [CompetitorType.EARLY_STAGE_VC]: {
    slug: CompetitorType.EARLY_STAGE_VC,
    name: "Early Stage VC-Backed Companies",
    description: "Early-stage startups that have raised venture capital funding, typically pre-Series A to Series A, with less than $10M total raised"
  },
  [CompetitorType.WELL_FUNDED_VC]: {
    slug: CompetitorType.WELL_FUNDED_VC, 
    name: "Well-Funded VC-Backed Companies",
    description: "Well-funded startups that have raised significant venture capital, typically Series B and beyond, with $10M+ raised and established market presence"
  },
  [CompetitorType.INCUMBENTS]: {
    slug: CompetitorType.INCUMBENTS,
    name: "Incumbent Companies",
    description: "Large established enterprises, public companies, or market leaders (e.g., Microsoft, Google, IBM) with existing products or divisions in this space"
  }
};

export const ALL_COMPETITOR_TYPES: CompetitorType[] = Object.values(CompetitorType);
