import { Injectable } from "@nestjs/common";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  type RGB,
  StandardFonts,
} from "pdf-lib";
import type {
  QuoteMapInput,
  QuoteMapRendererPort,
} from "@/modules/purchases/application/ports/quote-map-renderer.port";
import { ApprovalDecision } from "@/modules/purchases/domain/purchase-approval";
import {
  BRAND_COLORS as C,
  drawDoraMark,
  drawWordmark,
} from "@/shared/infrastructure/pdf/pdf-brand";
import {
  clampLines,
  fitText,
  winAnsi,
  wrapText,
} from "@/shared/infrastructure/pdf/pdf-text";
import { formatCents } from "@/shared/domain/money";

type Quote = QuoteMapInput["quotes"][number];
type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };
type Align = "left" | "right";

/** A4 landscape: a comparison reads across. */
const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = 32;
const WIDTH = PAGE.width - MARGIN * 2;
const HEADER = 58;
const TOP = PAGE.height - HEADER - 3 - 22;
const BOTTOM = 50;
/** Suppliers side by side; more go to another block of columns. */
const MAX_COLUMNS = 5;
const ITEM_MIN = 210;
const PAD = 7;

const percent = (bp: number) =>
  `${(bp / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const delivery = (days: number | null) =>
  days === null
    ? null
    : days === 0
      ? "Imediato"
      : days === 1
        ? "1 dia"
        : `${days} dias`;
const priced = (quote: Quote) =>
  quote.lines.filter((line) => line.lineCents !== null).length;

/** Complete quotes first, each group from the lowest total. */
const rank = (quotes: Quote[]) =>
  [...quotes].sort(
    (a, b) =>
      Number(b.complete) - Number(a.complete) || a.totalCents - b.totalCents,
  );

/** One column block of the tables: the item column and the suppliers. */
type Columns = { itemWidth: number; width: number; quotes: Quote[] };

/**
 * The comparison map (mapa de cotação) as the management files it: a dark
 * header with the Dora mark, the request, four numbers at a glance, the
 * price of each item side by side (lowest in green, chosen column in
 * orange) down to each total, each supplier's terms, and the result (the
 * chosen quote and why, or which one the lowest-price rule points to).
 */
@Injectable()
export class PdfLibQuoteMapRenderer implements QuoteMapRendererPort {
  async render(input: QuoteMapInput): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.setTitle(`Mapa de cotação ${input.code}`);
    doc.setCreator("Dora");
    const fonts: Fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    };
    new MapWriter(doc, fonts, input).write();
    return Buffer.from(await doc.save());
  }
}

class MapWriter {
  private readonly pages: PDFPage[] = [];
  private page!: PDFPage;
  private y = TOP;
  private readonly ranked: Quote[];

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts,
    private readonly input: QuoteMapInput,
  ) {
    this.ranked = rank(input.quotes);
  }

  write() {
    this.addPage();
    this.intro();
    this.summary();
    const blocks = Math.ceil(this.ranked.length / MAX_COLUMNS);
    for (let block = 0; block < blocks; block += 1) {
      const quotes = this.ranked.slice(
        block * MAX_COLUMNS,
        (block + 1) * MAX_COLUMNS,
      );
      const columns = this.columns(quotes);
      const part =
        blocks > 1
          ? ` · fornecedores ${block * MAX_COLUMNS + 1} a ${block * MAX_COLUMNS + quotes.length} de ${this.ranked.length}`
          : "";
      this.prices(columns, part);
      this.terms(columns, part);
    }
    this.result();
    this.approval();
    this.footers();
  }

  private addPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.pages.push(this.page);
    this.header();
    this.y = TOP;
  }

  /** Starts a new page when `height` doesn't fit; says whether it did. */
  private ensure(height: number): boolean {
    if (this.y - height >= BOTTOM) return false;
    this.addPage();
    return true;
  }

  private text(
    value: string,
    x: number,
    baseline: number,
    options: {
      size?: number;
      font?: PDFFont;
      color?: RGB;
      align?: Align;
      width?: number;
    } = {},
  ) {
    const font = options.font ?? this.fonts.regular;
    const size = options.size ?? 9;
    const safe =
      options.width !== undefined
        ? fitText(font, value, size, options.width)
        : winAnsi(font, value);
    const left =
      options.align === "right" ? x - font.widthOfTextAtSize(safe, size) : x;
    this.page.drawText(safe, {
      x: left,
      y: baseline,
      size,
      font,
      color: options.color ?? C.ink,
    });
  }

  private box(
    x: number,
    top: number,
    width: number,
    height: number,
    color: RGB,
    border?: RGB,
  ) {
    this.page.drawRectangle({
      x,
      y: top - height,
      width,
      height,
      color,
      ...(border ? { borderColor: border, borderWidth: 0.75 } : {}),
    });
  }

  private hLine(top: number, color = C.line, thickness = 0.5) {
    this.page.drawLine({
      start: { x: MARGIN, y: top },
      end: { x: MARGIN + WIDTH, y: top },
      thickness,
      color,
    });
  }

  private header() {
    const { bold } = this.fonts;
    const top = PAGE.height;
    this.box(0, top, PAGE.width, HEADER, C.black);
    this.box(0, top - HEADER, PAGE.width, 3, C.orange);
    drawDoraMark(this.page, MARGIN, top - 14, 30);
    drawWordmark(this.page, bold, MARGIN + 40, top - 36, 20);
    const right = PAGE.width - MARGIN;
    this.text("MAPA DE COTAÇÃO", right, top - 24, {
      font: bold,
      size: 8,
      color: C.orange,
      align: "right",
    });
    this.text(
      `${this.input.code}  ·  ${this.input.condominiumName}`,
      right,
      top - 41,
      { font: bold, size: 12, color: C.white, align: "right", width: 460 },
    );
  }

  private footers() {
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      this.page = page;
      this.hLine(BOTTOM - 14);
      this.text(
        `Gerado pelo Dora em ${this.input.generatedAt}  ·  ${this.input.code} · ${this.input.title}`,
        MARGIN,
        BOTTOM - 28,
        { size: 7, color: C.soft, width: WIDTH - 90 },
      );
      this.text(
        `Página ${index + 1} de ${total}`,
        MARGIN + WIDTH,
        BOTTOM - 28,
        {
          size: 7,
          color: C.soft,
          align: "right",
        },
      );
    });
  }

  /** A section title, kept on the page with `keepWith` points of what follows. */
  private section(title: string, note = "", keepWith = 60) {
    this.ensure(28 + keepWith);
    this.y -= 6;
    this.box(MARGIN, this.y, 3, 13, C.orange);
    this.text(title, MARGIN + 9, this.y - 10.5, {
      font: this.fonts.bold,
      size: 11.5,
    });
    if (note) {
      const at =
        MARGIN +
        9 +
        this.fonts.bold.widthOfTextAtSize(
          winAnsi(this.fonts.bold, title),
          11.5,
        ) +
        8;
      this.text(note, at, this.y - 10.5, {
        size: 8,
        color: C.muted,
        width: MARGIN + WIDTH - at,
      });
    }
    this.y -= 22;
  }

  private intro() {
    const { bold } = this.fonts;
    const lines = clampLines(
      bold,
      wrapText(bold, this.input.title, 17, WIDTH),
      17,
      WIDTH,
      2,
    );
    for (const line of lines) {
      this.text(line, MARGIN, this.y - 15, { font: bold, size: 17 });
      this.y -= 21;
    }
    const facts = [
      `Solicitado por ${this.input.requestedByName}`,
      this.input.neededBy ? `Necessário até ${this.input.neededBy}` : null,
      this.input.location ? `Local: ${this.input.location}` : null,
      `${this.input.items.length} ${this.input.items.length === 1 ? "item" : "itens"}`,
      `${this.input.quotes.length} ${this.input.quotes.length === 1 ? "cotação" : "cotações"}`,
    ].filter((fact): fact is string => fact !== null);
    for (const line of wrapText(
      this.fonts.regular,
      facts.join("   ·   "),
      9,
      WIDTH,
    )) {
      this.text(line, MARGIN, this.y - 6, { size: 9, color: C.muted });
      this.y -= 13;
    }
    this.y -= 10;
  }

  private summary() {
    const complete = this.ranked.filter((quote) => quote.complete);
    const cheapest = complete[0] ?? null;
    const totals = complete.map((quote) => quote.totalCents);
    const savings = totals.length
      ? Math.max(...totals) - Math.min(...totals)
      : 0;
    const fastest = this.input.quotes
      .filter((quote) => quote.deliveryDays !== null)
      .sort((a, b) => (a.deliveryDays ?? 0) - (b.deliveryDays ?? 0))[0];
    const cards: { label: string; value: string; hint: string; tone: RGB }[] = [
      {
        label: "MENOR TOTAL",
        value: cheapest ? formatCents(cheapest.totalCents) : "—",
        hint: cheapest?.supplierName ?? "Nenhuma cotação completa",
        tone: C.success,
      },
      {
        label: "ECONOMIA",
        value: formatCents(savings),
        hint: "Da mais cara para a mais barata",
        tone: C.orange,
      },
      {
        label: "ENTREGA MAIS RÁPIDA",
        value: delivery(fastest?.deliveryDays ?? null) ?? "—",
        hint: fastest?.supplierName ?? "Prazo não informado",
        tone: C.info,
      },
      {
        label: "COTAÇÕES COMPLETAS",
        value: `${complete.length} de ${this.input.quotes.length}`,
        hint:
          complete.length < this.input.quotes.length
            ? "Parciais não disputam o menor preço"
            : "Todas com todos os itens",
        tone: complete.length < this.input.quotes.length ? C.warning : C.soft,
      },
    ];
    const gap = 10;
    const width = (WIDTH - gap * (cards.length - 1)) / cards.length;
    const height = 60;
    cards.forEach((card, index) => {
      const x = MARGIN + index * (width + gap);
      this.box(x, this.y, width, height, C.white, C.line);
      this.box(x, this.y, width, 3, card.tone);
      this.text(card.label, x + 10, this.y - 16, {
        font: this.fonts.bold,
        size: 7,
        color: C.soft,
      });
      this.text(card.value, x + 10, this.y - 36, {
        font: this.fonts.bold,
        size: 16,
        width: width - 20,
      });
      this.text(card.hint, x + 10, this.y - 50, {
        size: 7.5,
        color: C.muted,
        width: width - 20,
      });
    });
    this.y -= height + 16;
  }

  private columns(quotes: Quote[]): Columns {
    const width = Math.min(135, (WIDTH - ITEM_MIN) / quotes.length);
    return { itemWidth: WIDTH - width * quotes.length, width, quotes };
  }

  private columnX(columns: Columns, index: number) {
    return MARGIN + columns.itemWidth + index * columns.width;
  }

  /** The dark header row: the first column's title and each supplier. */
  private tableHead(columns: Columns, first: string, align: Align) {
    const { bold } = this.fonts;
    const height = 36;
    this.box(MARGIN, this.y, WIDTH, height, C.black);
    this.text(first, MARGIN + PAD + 2, this.y - 21, {
      font: bold,
      size: 7.5,
      color: C.white,
    });
    columns.quotes.forEach((quote, index) => {
      const x = this.columnX(columns, index);
      if (quote.chosen) this.box(x, this.y, columns.width, height, C.orange);
      if (quote.cheapest) {
        this.box(x, this.y - height + 3, columns.width, 3, C.success);
      }
      const ink = quote.chosen ? C.black : C.white;
      const anchor = align === "right" ? x + columns.width - PAD : x + PAD;
      const place = this.ranked.indexOf(quote) + 1;
      const tag = [
        `${place}º`,
        quote.chosen ? "ESCOLHIDA" : null,
        quote.cheapest ? "MAIS BARATA" : null,
        quote.complete ? null : "PARCIAL",
      ]
        .filter(Boolean)
        .join(" · ");
      this.text(tag, anchor, this.y - 12, {
        font: bold,
        size: 6.5,
        color: quote.chosen ? C.black : C.orange,
        align,
        width: columns.width - PAD * 2,
      });
      const name = clampLines(
        bold,
        wrapText(bold, quote.supplierName, 8.5, columns.width - PAD * 2),
        8.5,
        columns.width - PAD * 2,
        2,
      );
      name.forEach((line, at) =>
        this.text(line, anchor, this.y - 22 - at * 9.5, {
          font: bold,
          size: 8.5,
          color: ink,
          align,
        }),
      );
    });
    this.y -= height;
  }

  /** A row: a new page (with the head again) when it doesn't fit. */
  private row(height: number, head: () => void, draw: (top: number) => void) {
    if (this.ensure(height)) head();
    draw(this.y);
    this.y -= height;
  }

  private prices(columns: Columns, part: string) {
    const { regular, bold, italic } = this.fonts;
    this.section(
      "Preço por item",
      `O menor preço de cada item em verde${part}`,
      36 + 44,
    );
    const head = () => this.tableHead(columns, "ITEM", "right");
    head();

    // Lowest line total of each item among all quotes (not only this block).
    const lowest = this.input.items.map((_, index) => {
      const values = this.input.quotes
        .map((quote) => quote.lines[index]?.lineCents)
        .filter((value): value is number => typeof value === "number");
      return values.length ? Math.min(...values) : null;
    });

    this.input.items.forEach((item, index) => {
      const labelWidth = columns.itemWidth - PAD * 2 - 2;
      const label = clampLines(
        regular,
        wrapText(regular, `${index + 1}. ${item.label}`, 8.5, labelWidth),
        8.5,
        labelWidth,
        3,
      );
      const height = Math.max(32, 14 + label.length * 10.5 + 10);
      this.row(height, head, (top) => {
        if (index % 2 === 1)
          this.box(MARGIN, top, WIDTH, height, C.surfaceMuted);
        columns.quotes.forEach((quote, at) => {
          if (quote.chosen) {
            this.box(
              this.columnX(columns, at),
              top,
              columns.width,
              height,
              C.orangeSoft,
            );
          }
        });
        label.forEach((line, at) =>
          this.text(line, MARGIN + PAD + 2, top - 13 - at * 10.5, {
            font: at === 0 ? bold : regular,
            size: 8.5,
          }),
        );
        this.text(
          item.quantity,
          MARGIN + PAD + 2,
          top - 13 - label.length * 10.5,
          {
            size: 7.5,
            color: C.soft,
          },
        );
        columns.quotes.forEach((quote, at) => {
          const x = this.columnX(columns, at);
          const right = x + columns.width - PAD;
          const line = quote.lines[index];
          if (!line || line.lineCents === null || line.unitCents === null) {
            this.text("Não cotou", right, top - 15, {
              font: italic,
              size: 8,
              color: C.soft,
              align: "right",
            });
            return;
          }
          const best = line.lineCents === lowest[index];
          if (best) {
            this.page.drawRectangle({
              x: x + 4,
              y: top - height + 4,
              width: columns.width - 8,
              height: height - 8,
              color: C.successSoft,
              borderColor: C.successBorder,
              borderWidth: 0.75,
            });
          }
          this.text(formatCents(line.lineCents), right, top - 15, {
            font: bold,
            size: 9.5,
            color: best ? C.success : C.ink,
            align: "right",
          });
          this.text(`${formatCents(line.unitCents)} / un.`, right, top - 26, {
            size: 7,
            color: best ? C.success : C.soft,
            align: "right",
          });
        });
        this.hLine(top - height);
      });
    });

    this.breakdown(columns, head);
    this.legend();
  }

  /** How each total is made up, then the totals. Rows nobody has are left out. */
  private breakdown(columns: Columns, head: () => void) {
    const { regular, bold } = this.fonts;
    type Cell = { value: string | null; detail: string | null };
    const rows: { label: string; tone: RGB; cell: (quote: Quote) => Cell }[] = [
      {
        label: "Subtotal dos itens",
        tone: C.ink,
        cell: (quote) => ({
          value: formatCents(quote.itemsCents),
          detail: null,
        }),
      },
      {
        label: "Frete",
        tone: C.ink,
        cell: (quote) => ({
          value: quote.shippingCents ? formatCents(quote.shippingCents) : null,
          detail: null,
        }),
      },
      {
        label: "Encargos",
        tone: C.ink,
        cell: (quote) => ({
          value: quote.charges.length
            ? formatCents(
                quote.charges.reduce((sum, c) => sum + c.amountCents, 0),
              )
            : null,
          detail: quote.charges.length
            ? quote.charges
                .map((c) => `${c.label}: ${formatCents(c.amountCents)}`)
                .join(" · ")
            : null,
        }),
      },
      {
        label: "Desconto",
        tone: C.success,
        cell: (quote) => ({
          value: quote.discountCents
            ? `- ${formatCents(quote.discountCents)}`
            : null,
          detail:
            quote.discountCents && quote.discountPercentBp
              ? `${percent(quote.discountPercentBp)} sobre o valor`
              : null,
        }),
      },
      {
        label: "Juros",
        tone: C.danger,
        cell: (quote) => ({
          value: quote.interestCents
            ? `+ ${formatCents(quote.interestCents)}`
            : null,
          detail:
            quote.interestCents && quote.interestRateBp
              ? `${percent(quote.interestRateBp)} a.m.`
              : null,
        }),
      },
    ];
    const cellWidth = columns.width - PAD * 2;

    for (const row of rows) {
      const cells = columns.quotes.map(row.cell);
      if (cells.every((cell) => cell.value === null)) continue;
      const details = cells.map((cell) =>
        cell.detail
          ? clampLines(
              regular,
              wrapText(regular, cell.detail, 6.5, cellWidth),
              6.5,
              cellWidth,
              3,
            )
          : [],
      );
      const extra = Math.max(...details.map((lines) => lines.length));
      const height = 20 + extra * 8;
      this.row(height, head, (top) => {
        this.box(MARGIN, top, WIDTH, height, C.surfaceMuted);
        this.text(row.label, MARGIN + PAD + 2, top - 13, {
          size: 8,
          color: C.muted,
        });
        cells.forEach((cell, at) => {
          const right = this.columnX(columns, at) + columns.width - PAD;
          this.text(cell.value ?? "—", right, top - 13, {
            font: cell.value ? bold : regular,
            size: 8.5,
            color: cell.value ? row.tone : C.soft,
            align: "right",
          });
          details[at].forEach((line, index) =>
            this.text(line, right, top - 22 - index * 8, {
              size: 6.5,
              color: C.soft,
              align: "right",
            }),
          );
        });
        this.hLine(top - height, C.white, 1);
      });
    }

    const height = 34;
    this.row(height, head, (top) => {
      this.box(MARGIN, top, WIDTH, height, C.orangeSoft);
      this.hLine(top, C.orange, 1.5);
      this.text("TOTAL", MARGIN + PAD + 2, top - 20, { font: bold, size: 10 });
      columns.quotes.forEach((quote, at) => {
        const right = this.columnX(columns, at) + columns.width - PAD;
        this.text(formatCents(quote.totalCents), right, top - 17, {
          font: bold,
          size: 12,
          color: quote.cheapest ? C.success : C.ink,
          align: "right",
        });
        const note = quote.interestCents
          ? `${formatCents(quote.cashCents)} à vista`
          : quote.complete
            ? null
            : "Parcial: faltam itens";
        if (note) {
          this.text(note, right, top - 28, {
            size: 6.5,
            color: quote.complete ? C.soft : C.warning,
            align: "right",
          });
        }
      });
      this.hLine(top - height, C.orange, 1.5);
    });
  }

  private legend() {
    const entries: [RGB, RGB, string][] = [
      [C.successSoft, C.successBorder, "Menor preço do item"],
      [C.orange, C.orange, "Cotação escolhida"],
      [C.success, C.success, "Menor total entre as completas"],
    ];
    this.y -= 8;
    let x = MARGIN;
    for (const [fill, border, label] of entries) {
      this.page.drawRectangle({
        x,
        y: this.y - 8,
        width: 8,
        height: 8,
        color: fill,
        borderColor: border,
        borderWidth: 0.75,
      });
      this.text(label, x + 12, this.y - 7, { size: 7, color: C.muted });
      x += 12 + this.fonts.regular.widthOfTextAtSize(label, 7) + 18;
    }
    this.y -= 22;
  }

  private terms(columns: Columns, part: string) {
    const { regular, bold, italic } = this.fonts;
    const items = this.input.items.length;
    const rows: {
      label: string;
      value: (quote: Quote) => string | null;
      max: number;
    }[] = [
      {
        label: "Prazo de entrega",
        value: (quote) => delivery(quote.deliveryDays),
        max: 1,
      },
      { label: "Pagamento", value: (quote) => quote.payment, max: 3 },
      {
        label: "Validade da proposta",
        value: (quote) => quote.validUntil,
        max: 1,
      },
      {
        label: "Itens cotados",
        value: (quote) => `${priced(quote)} de ${items}`,
        max: 1,
      },
      {
        label: "Orçamento anexo",
        value: (quote) => quote.file ?? "Não",
        max: 1,
      },
      { label: "Observações", value: (quote) => quote.notes, max: 4 },
    ];
    this.section(
      "Condições",
      `Prazo, pagamento e validade de cada fornecedor${part}`,
      36 + 66,
    );
    const head = () => this.tableHead(columns, "CONDIÇÃO", "left");
    head();
    const cellWidth = columns.width - PAD * 2;
    rows.forEach((row, index) => {
      const cells = columns.quotes.map((quote) => {
        const value = row.value(quote);
        return value
          ? clampLines(
              regular,
              wrapText(regular, value, 8, cellWidth),
              8,
              cellWidth,
              row.max,
            )
          : null;
      });
      if (row.label === "Observações" && cells.every((cell) => cell === null))
        return;
      const lines = Math.max(1, ...cells.map((cell) => cell?.length ?? 1));
      const height = 12 + lines * 10;
      this.row(height, head, (top) => {
        if (index % 2 === 1)
          this.box(MARGIN, top, WIDTH, height, C.surfaceMuted);
        this.text(row.label, MARGIN + PAD + 2, top - 14, {
          font: bold,
          size: 8,
          color: C.muted,
        });
        cells.forEach((cell, at) => {
          const x = this.columnX(columns, at) + PAD;
          if (!cell) {
            this.text("—", x, top - 14, { size: 8, color: C.soft });
            return;
          }
          const partial =
            row.label === "Itens cotados" && !columns.quotes[at].complete;
          cell.forEach((line, n) =>
            this.text(line, x, top - 14 - n * 10, {
              font: row.label === "Observações" ? italic : regular,
              size: 8,
              color: partial ? C.warning : C.ink,
            }),
          );
        });
        this.hLine(top - height);
      });
    });
    this.y -= 14;
  }

  private result() {
    const { regular, bold } = this.fonts;
    const chosen = this.input.quotes.find((quote) => quote.chosen) ?? null;
    const cheapest = this.ranked.find((quote) => quote.cheapest) ?? null;
    const inner = WIDTH - 32;
    const justification =
      chosen && this.input.justification
        ? wrapText(regular, this.input.justification, 9, inner)
        : [];
    const height = chosen
      ? 58 + (justification.length ? 16 + justification.length * 12 : 0)
      : 50;
    this.section("Resultado", "", height + 4);
    const tone = chosen ? C.orange : C.info;
    this.box(MARGIN, this.y, WIDTH, height, chosen ? C.orangeSoft : C.infoSoft);
    this.box(MARGIN, this.y, 4, height, tone);
    const x = MARGIN + 18;
    const right = MARGIN + WIDTH - 16;
    if (chosen) {
      this.text("COTAÇÃO ESCOLHIDA", x, this.y - 16, {
        font: bold,
        size: 7.5,
        color: C.orangeInk,
      });
      this.text(chosen.supplierName, x, this.y - 33, {
        font: bold,
        size: 14,
        width: inner - 160,
      });
      this.text(formatCents(chosen.totalCents), right, this.y - 33, {
        font: bold,
        size: 14,
        color: chosen.cheapest ? C.success : C.ink,
        align: "right",
      });
      this.text(
        [
          this.input.chosenByName
            ? `Escolhida por ${this.input.chosenByName}`
            : null,
          chosen.cheapest ? "Menor total entre as completas" : null,
          chosen.payment,
          delivery(chosen.deliveryDays)
            ? `Entrega: ${delivery(chosen.deliveryDays)}`
            : null,
        ]
          .filter(Boolean)
          .join("   ·   "),
        x,
        this.y - 47,
        { size: 8.5, color: C.muted, width: inner },
      );
      if (justification.length) {
        this.text("Justificativa", x, this.y - 64, {
          font: bold,
          size: 8,
          color: C.orangeInk,
        });
        justification.forEach((line, index) =>
          this.text(line, x, this.y - 77 - index * 12, { size: 9 }),
        );
      }
    } else {
      this.text("AINDA SEM ESCOLHA", x, this.y - 18, {
        font: bold,
        size: 7.5,
        color: C.info,
      });
      this.text(
        cheapest
          ? `Pelo menor preço, a indicada é ${cheapest.supplierName}: ${formatCents(cheapest.totalCents)}.`
          : "Nenhuma cotação tem preço para todos os itens.",
        x,
        this.y - 36,
        { font: bold, size: 11, width: inner },
      );
    }
    this.y -= height + 10;
  }

  /** The approval: waiting, approved (by whom, or within the limit) or rejected, and the signature lines. */
  private approval() {
    const { regular, bold } = this.fonts;
    const chosen = this.input.quotes.find((quote) => quote.chosen);
    if (!chosen) return;
    const decision = this.input.decision;
    const limit = (cents: number | null) =>
      cents === null ? "" : ` (alçada de ${formatCents(cents)})`;
    const look =
      decision === null
        ? {
            tag: "AGUARDANDO APROVAÇÃO",
            line: "A cotação escolhida espera a decisão de quem aprova as compras.",
            fill: C.warningSoft,
            tone: C.warning,
          }
        : decision.kind === ApprovalDecision.AUTO_APPROVED
          ? {
              tag: "APROVADA NA ALÇADA",
              line: `Total dentro do limite${limit(decision.limitCents)}: aprovada ao ser escolhida, em ${decision.at}.`,
              fill: C.successSoft,
              tone: C.success,
            }
          : decision.kind === ApprovalDecision.APPROVED
            ? {
                tag: "APROVADA",
                line: `Aprovada por ${decision.byName ?? "—"} em ${decision.at}${limit(decision.limitCents)}.`,
                fill: C.successSoft,
                tone: C.success,
              }
            : {
                tag: "REPROVADA",
                line: `Reprovada por ${decision.byName ?? "—"} em ${decision.at}.`,
                fill: C.dangerSoft,
                tone: C.danger,
              };
    const inner = WIDTH - 32;
    const noteLabel =
      decision?.kind === ApprovalDecision.REJECTED ? "Motivo" : "Observação";
    const note = decision?.note
      ? wrapText(regular, decision.note, 9, inner)
      : [];
    const height = 44 + (note.length ? 14 + note.length * 12 : 0);
    const signatures = 62;
    this.section("Aprovação", "", height + signatures + 8);
    this.box(MARGIN, this.y, WIDTH, height, look.fill);
    this.box(MARGIN, this.y, 4, height, look.tone);
    const x = MARGIN + 18;
    this.text(look.tag, x, this.y - 16, {
      font: bold,
      size: 7.5,
      color: look.tone,
    });
    this.text(look.line, x, this.y - 31, {
      font: bold,
      size: 10,
      width: inner,
    });
    if (note.length) {
      this.text(noteLabel, x, this.y - 47, {
        font: bold,
        size: 8,
        color: look.tone,
      });
      note.forEach((line, index) =>
        this.text(line, x, this.y - 60 - index * 12, { size: 9 }),
      );
    }
    this.y -= height + 14;

    const approver =
      decision &&
      decision.kind !== ApprovalDecision.AUTO_APPROVED &&
      decision.byName
        ? decision.byName
        : "";
    const width = (WIDTH - 40) / 2;
    [
      { label: "Escolhida por", name: this.input.chosenByName ?? "" },
      {
        label:
          decision?.kind === ApprovalDecision.REJECTED
            ? "Reprovada por"
            : "Aprovada por",
        name: approver,
      },
    ].forEach((sign, index) => {
      const left = MARGIN + index * (width + 40);
      const line = this.y - 30;
      this.page.drawLine({
        start: { x: left, y: line },
        end: { x: left + width, y: line },
        thickness: 0.75,
        color: C.soft,
      });
      this.text(sign.name || " ", left, line - 12, {
        font: bold,
        size: 9,
        width,
      });
      this.text(sign.label, left, line - 23, {
        size: 7.5,
        color: C.muted,
      });
    });
    this.y -= signatures;
  }
}
