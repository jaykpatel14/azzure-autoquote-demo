export type RenderSpecs = {
  centerShape?: string | null;
  centerDiamondCarats: number;
  sideDiamondQuantity: number;
  sideDiamondCarats: number;
  settingType?: string | null;
  hasWeddingBand?: boolean;
  isTwoTone?: boolean;
};

const SHAPES = ["round", "oval", "emerald", "cushion", "radiant", "pear", "marquise", "princess", "asscher", "heart"];

/** Applies natural-language revisions from left to right so the latest request wins. */
export function applyRenderRefinements<T extends RenderSpecs>(specs: T, prompt?: string): T {
  if (!prompt?.trim()) return specs;

  const next = { ...specs };
  const revisions = prompt.toLowerCase().split(/(?:\.|\n|;|\bthen\b|\u2192)+/).map((item) => item.trim()).filter(Boolean);

  for (const revision of revisions) {
    const removesSideStones = /\b(?:remove|without|no|delete|omit)\b[^.]{0,50}\b(?:side|accent|pav[eÃ©]|halo)\b/.test(revision);
    const addsSideStones = /\b(?:add|include|with|restore)\b[^.]{0,50}\b(?:side|accent|pav[eÃ©]|halo)\b/.test(revision);
    if (removesSideStones) {
      next.sideDiamondQuantity = 0;
      next.sideDiamondCarats = 0;
      if (next.settingType === "halo") next.settingType = "prong";
    } else if (addsSideStones) {
      const quantity = revision.match(/\b(\d{1,2})\s+(?:side|accent|pav[eÃ©])\b/);
      next.sideDiamondQuantity = quantity ? Number(quantity[1]) : Math.max(next.sideDiamondQuantity, /halo/.test(revision) ? 24 : 2);
      if (next.sideDiamondCarats <= 0) next.sideDiamondCarats = /halo|pav[eÃ©]/.test(revision) ? 0.5 : 0.25;
      if (/halo/.test(revision)) next.settingType = "halo";
    }

    const centerCarats = revision.match(/(\d+(?:\.\d+)?)\s*(?:ct|carat)s?\b(?:\s+center)?/);
    if (centerCarats) next.centerDiamondCarats = Number(centerCarats[1]);

    const sideCarats = revision.match(/(\d+(?:\.\d+)?)\s*(?:ct|carat)s?\s+(?:total\s+)?(?:side|accent)/);
    if (sideCarats && !removesSideStones) next.sideDiamondCarats = Number(sideCarats[1]);

    const shape = SHAPES.find((candidate) => new RegExp(`\\b${candidate}\\b`).test(revision));
    if (shape) next.centerShape = shape;

    if (/\bbezel\b/.test(revision)) next.settingType = "bezel";
    else if (/\btension\b/.test(revision)) next.settingType = "tension";
    else if (/\bprong\b/.test(revision)) next.settingType = "prong";
    else if (/\bhalo\b/.test(revision) && !removesSideStones) next.settingType = "halo";

    if (/\b(?:remove|without|no|omit)\b[^.]{0,40}\b(?:wedding|matching)\s+band\b/.test(revision)) next.hasWeddingBand = false;
    else if (/\b(?:add|include|with)\b[^.]{0,40}\b(?:wedding|matching)\s+band\b/.test(revision)) next.hasWeddingBand = true;

    if (/\b(?:remove|without|no)\b[^.]{0,30}\btwo[- ]tone\b/.test(revision)) next.isTwoTone = false;
    else if (/\b(?:add|make|use|with)\b[^.]{0,30}\btwo[- ]tone\b/.test(revision)) next.isTwoTone = true;
  }

  return next;
}
