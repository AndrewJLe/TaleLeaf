// Shared tag color utilities extracted from BaseEntityCard to avoid duplication.
// Palette kept small and stable for deterministic hashing.
export const TAG_PALETTE = [
  "#F97316", // orange
  "#EF4444", // red
  "#10B981", // emerald
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#F59E0B", // amber
  "#06B6D4", // teal
  "#EC4899", // pink
  "#6366F1", // indigo
  "#84CC16", // lime
];

export const hashString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

export const colorForTagName = (
  tag: string,
  overrides: Record<string, string> = {},
) => {
  const lower = tag.toLowerCase();
  if (overrides[lower]) return overrides[lower];
  const idx = hashString(lower) % TAG_PALETTE.length;
  return TAG_PALETTE[idx];
};

export const luminance = (hex: string) => {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const a = [r, g, b].map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
};

export const readableTextColor = (bgHex: string) =>
  luminance(bgHex) > 0.5 ? "#111827" : "#ffffff";

export const hexToRgba = (hex: string, alpha = 0.6) => {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const isValidSimpleTag = (t: string) => /^[a-z0-9]+$/.test(t);
