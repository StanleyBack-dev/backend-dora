import type { PDFFont } from "pdf-lib";

// Text helpers for pdf-lib's standard fonts, which only encode WinAnsi.

/** The text as the font can write it: the math minus becomes "-", anything else unknown "?". */
export function winAnsi(font: PDFFont, text: string): string {
  return [...text.normalize("NFC").replace(/−/g, "-")]
    .map((char) => {
      try {
        font.encodeText(char);
        return char;
      } catch {
        return "?";
      }
    })
    .join("");
}

/** Words broken into lines that fit the width (a long word is cut). */
export function wrapText(
  font: PDFFont,
  text: string,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of winAnsi(font, text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = fitText(font, word, size, width);
    }
    lines.push(line);
  }
  return lines;
}

/** The text cut with "…" to fit the width. */
export function fitText(
  font: PDFFont,
  text: string,
  size: number,
  width: number,
): string {
  const safe = winAnsi(font, text);
  if (font.widthOfTextAtSize(safe, size) <= width) return safe;
  let cut = safe;
  while (cut && font.widthOfTextAtSize(`${cut}…`, size) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

/** At most `max` lines, the last ending in "…" when text was left out. */
export function clampLines(
  font: PDFFont,
  lines: string[],
  size: number,
  width: number,
  max: number,
): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = fitText(font, `${kept[max - 1]}…`, size, width);
  return kept;
}
