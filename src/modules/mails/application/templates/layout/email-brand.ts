// Mirrors the Dora design tokens (frontend-dora/src/app/globals.css) so
// transactional emails match the app: black header with the orange mark,
// white card, orange call-to-action with black text (readable contrast).
export const EMAIL_BRAND = {
  pageBackground: "#f5f5f4",
  surface: "#ffffff",
  cardBackground: "#fafaf9",
  headerBackground: "#0a0a0a",
  /** The dot of the "dora." logo on the dark header. */
  orange: "#ff6b1a",
  /** Call-to-action button (text in `accentText`). */
  accent: "#ff6b1a",
  accentText: "#0a0a0a",
  accentSoft: "#fff1e8",
  danger: "#c0362c",
  dangerSoft: "#fdecea",
  border: "#e7e5e4",
  text: "#0a0a0a",
  textMuted: "#44403c",
  textSoft: "#78716c",
  white: "#ffffff",
  headerText: "#ffffff",
} as const;
