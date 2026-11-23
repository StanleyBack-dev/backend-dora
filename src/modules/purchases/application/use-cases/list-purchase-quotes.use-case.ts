import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  PURCHASE_QUOTE_REPOSITORY,
  type PurchaseQuoteRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import {
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseRequestRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import {
  QUOTE_MAP_RENDERER,
  type QuoteMapRendererPort,
} from "@/modules/purchases/application/ports/quote-map-renderer.port";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { Permission } from "@/modules/access-control/domain/permission";
import {
  PURCHASE_APPROVAL_REPOSITORY,
  type PurchaseApprovalRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-approval-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  cheapestQuoteIds,
  installmentPlan,
  lineCents,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  type PurchaseQuote,
  quoteTotals,
  type QuoteTotals,
} from "@/modules/purchases/domain/purchase-quote";
import {
  type PurchaseRequest,
  PurchaseRequestStatus,
  requestCode,
} from "@/modules/purchases/domain/purchase-request";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

/** A quote with its totals, as the comparison shows it. */
export type QuoteView = PurchaseQuote &
  QuoteTotals & {
    /** The cheapest complete quote (ties share it). */
    cheapest: boolean;
    /** The one the management chose. */
    chosen: boolean;
    /** A short-lived link to the supplier's document (null: none). */
    fileUrl: string | null;
    /** Each installment (empty: paid at once). */
    installmentValues: number[];
    /** Quantity × unit price per item, in the request's order. */
    lines: {
      requestItemId: string;
      unitPriceCents: number | null;
      lineCents: number | null;
    }[];
  };

/** The map as a file, with what an e-mail about it says. */
export type QuoteMapFile = {
  fileName: string;
  content: Buffer;
  /** "SC-0007". */
  code: string;
  title: string;
  condominiumName: string;
  quoteCount: number;
  /** "Supplier · R$ 114,70" (null: none). */
  cheapest: string | null;
  chosen: string | null;
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** How a quote is paid, as a line ("Cartão de crédito · 3x de R$ 56,60"). */
export function paymentLine(
  quote: Pick<
    PurchaseQuote,
    "paymentMethod" | "installments" | "paymentTerms"
  > & { cashCents: number; interestRateBp: number | null },
): string | null {
  if (!quote.paymentMethod) return null;
  const method =
    quote.paymentMethod === PaymentMethod.OTHER
      ? (quote.paymentTerms ?? PAYMENT_METHOD_LABELS[PaymentMethod.OTHER])
      : PAYMENT_METHOD_LABELS[quote.paymentMethod];
  if (!quote.installments) return `${method} · à vista`;
  const parts = installmentPlan(
    quote.cashCents,
    quote.installments,
    quote.interestRateBp,
  );
  const last = parts[parts.length - 1];
  const split =
    last === parts[0]
      ? `${quote.installments}x de ${money(parts[0])}`
      : `${quote.installments}x de ${money(parts[0])} (última de ${money(last)})`;
  const interest = quote.interestRateBp
    ? ` com juros de ${(quote.interestRateBp / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}% a.m.`
    : " sem juros";
  return `${method} · ${split}${interest}`;
}

/** "21/11/2026" from "2026-11-21". */
const day = (value: string) => value.split("-").reverse().join("/");

// The quotes of a request for the management: totals, the cheapest
// complete one and the chosen one, in the request's item order; and the
// comparison map as a PDF.
@Injectable()
export class ListPurchaseQuotesUseCase {
  constructor(
    @Inject(PURCHASE_QUOTE_REPOSITORY)
    private readonly quotes: PurchaseQuoteRepositoryPort,
    @Inject(PURCHASE_REQUEST_REPOSITORY)
    private readonly requests: PurchaseRequestRepositoryPort,
    private readonly access: PurchasesAccessService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(QUOTE_MAP_RENDERER) private readonly renderer: QuoteMapRendererPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly condominiums: CondominiumLookupService,
    @Inject(PURCHASE_APPROVAL_REPOSITORY)
    private readonly approvals: PurchaseApprovalRepositoryPort,
  ) {}

  // The management and the approvers read the quotes.
  private async load(actor: AuthenticatedUser, requestId: string) {
    const condominiumId = await this.access.condominiumWithAny(
      actor,
      Permission.PURCHASES_MANAGE,
      Permission.PURCHASES_APPROVE,
    );
    const request = await this.requests.find(condominiumId, requestId);
    if (!request) {
      throw AppException.from(APP_ERRORS.purchases.requestNotFound, undefined);
    }
    return request;
  }

  private async views(request: PurchaseRequest): Promise<QuoteView[]> {
    const quantities = new Map(
      request.items.map((item) => [item.id, item.quantity]),
    );
    const quotes = await this.quotes.listFor(request.id);
    const withTotals = quotes.map((quote) => ({
      quote,
      totals: quoteTotals(quote, quantities),
    }));
    const cheapest = cheapestQuoteIds(
      withTotals.map(({ quote, totals }) => ({ id: quote.id, ...totals })),
    );
    return Promise.all(
      withTotals.map(async ({ quote, totals }) => ({
        ...quote,
        ...totals,
        cheapest: cheapest.includes(quote.id),
        installmentValues: quote.installments
          ? installmentPlan(
              totals.cashCents,
              quote.installments,
              quote.interestRateBp,
            )
          : [],
        chosen: request.chosenQuoteId === quote.id,
        fileUrl: quote.fileKey
          ? await this.storage.signedReadUrl(quote.fileKey)
          : null,
        lines: request.items.map((item) => {
          const unitPriceCents =
            quote.items.find((line) => line.requestItemId === item.id)
              ?.unitPriceCents ?? null;
          return {
            requestItemId: item.id,
            unitPriceCents,
            lineCents:
              unitPriceCents === null
                ? null
                : lineCents(item.quantity, unitPriceCents),
          };
        }),
      })),
    );
  }

  async list(
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<QuoteView[]> {
    return this.views(await this.load(actor, requestId));
  }

  /** One quote as the comparison shows it (after saving it). */
  async one(
    actor: AuthenticatedUser,
    requestId: string,
    quoteId: string,
  ): Promise<QuoteView> {
    const view = (await this.list(actor, requestId)).find(
      (each) => each.id === quoteId,
    );
    if (!view) {
      throw AppException.from(APP_ERRORS.purchases.quoteNotFound, undefined);
    }
    return view;
  }

  /** The comparison map (mapa de cotação) as a PDF, and what it is about. */
  async mapPdf(
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<QuoteMapFile> {
    const request = await this.load(actor, requestId);
    const [views, condominium] = await Promise.all([
      this.views(request),
      this.condominiums.find(request.condominiumId),
    ]);
    const now = this.clock.now();
    const generatedAt = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: this.clock.timeZone,
    }).format(now);
    const code = requestCode(request.number);
    // The decision that stands (none once sent back to quotes).
    const decided =
      request.status === PurchaseRequestStatus.APPROVED ||
      request.status === PurchaseRequestStatus.REJECTED;
    const latest = decided
      ? (await this.approvals.history(request.id))[0]
      : undefined;
    const when = (date: Date) =>
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: this.clock.timeZone,
      }).format(date);
    const content = await this.renderer.render({
      code,
      title: request.title,
      condominiumName: condominium?.name ?? "Condomínio",
      requestedByName: request.requestedByName,
      neededBy: request.neededBy ? day(request.neededBy) : null,
      location: request.location,
      generatedAt,
      items: request.items.map((item) => ({
        label: [item.productName, item.brandName, item.note]
          .filter(Boolean)
          .join(" · "),
        quantity: `${item.quantity.toLocaleString("pt-BR")} ${item.unit}`,
      })),
      quotes: views.map((view) => ({
        supplierName: view.supplierName,
        lines: view.lines.map((line) => ({
          unitCents: line.unitPriceCents,
          lineCents: line.lineCents,
        })),
        itemsCents: view.itemsCents,
        shippingCents: view.shippingCents,
        charges: view.charges,
        discountCents: view.discountCents,
        discountPercentBp: view.discountPercentBp,
        interestRateBp: view.interestRateBp,
        cashCents: view.cashCents,
        interestCents: view.interestCents,
        totalCents: view.totalCents,
        complete: view.complete,
        cheapest: view.cheapest,
        chosen: view.chosen,
        deliveryDays: view.deliveryDays,
        payment: paymentLine(view),
        validUntil: view.validUntil ? day(view.validUntil) : null,
        notes: view.notes,
        file: view.fileKey ? (view.fileIsPdf ? "PDF" : "Imagem") : null,
      })),
      justification: request.choiceJustification,
      chosenByName: request.chosenByName,
      decision: latest
        ? {
            kind: latest.decision,
            byName: latest.decidedByName,
            at: when(latest.decidedAt),
            note: latest.note,
            limitCents: latest.limitCents,
          }
        : null,
    });
    const pick = (view: QuoteView | undefined) =>
      view ? `${view.supplierName} · ${money(view.totalCents)}` : null;
    return {
      fileName: `mapa-de-cotacao-${code}.pdf`,
      content,
      code,
      title: request.title,
      condominiumName: condominium?.name ?? "Condomínio",
      quoteCount: views.length,
      cheapest: pick(views.find((view) => view.cheapest)),
      chosen: pick(views.find((view) => view.chosen)),
    };
  }
}
