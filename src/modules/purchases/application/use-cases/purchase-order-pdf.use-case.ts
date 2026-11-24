import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { formatQuantity } from "@/modules/catalog/domain/unit";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import {
  PURCHASE_ORDER_REPOSITORY,
  type PurchaseOrderRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-order-repository.port";
import {
  PURCHASE_ORDER_RENDERER,
  type PurchaseOrderInput,
  type PurchaseOrderRendererPort,
} from "@/modules/purchases/application/ports/purchase-order-renderer.port";
import {
  PURCHASE_QUOTE_REPOSITORY,
  type PurchaseQuoteRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import { ListPurchaseOrdersUseCase } from "@/modules/purchases/application/use-cases/list-purchase-orders.use-case";
import {
  orderCode,
  type PurchaseOrder,
} from "@/modules/purchases/domain/purchase-order";
import {
  lineCents,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  type PurchaseQuote,
  quoteTotals,
} from "@/modules/purchases/domain/purchase-quote";
import {
  type PurchaseRequest,
  requestCode,
} from "@/modules/purchases/domain/purchase-request";
import {
  SUPPLIER_REPOSITORY,
  type SupplierRepositoryPort,
} from "@/modules/suppliers/application/ports/supplier-repository.port";
import {
  type Supplier,
  SupplierDocumentType,
} from "@/modules/suppliers/domain/supplier";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { formatCnpj } from "@/shared/domain/cnpj";
import {
  DocumentType,
  formatDocument,
} from "@/shared/domain/identity-document";
import { formatLocalDate, toLocalDate } from "@/shared/domain/local-date";
import { formatCents } from "@/shared/domain/money";
import { formatPhone } from "@/shared/domain/phone";

const documentOf = (supplier: Supplier) =>
  supplier.documentType === SupplierDocumentType.CNPJ
    ? formatCnpj(supplier.document)
    : formatDocument(DocumentType.CPF, supplier.document);

/** The purchase order PDF with what an e-mail about it says. */
export type PurchaseOrderFile = {
  fileName: string;
  content: Buffer;
  code: string;
  request: string;
  total: string;
  condominiumName: string;
};

/**
 * The purchase order (ordem de compra) as a PDF to send to the supplier: the
 * buyer, the supplier, the delivery, the items priced from the chosen
 * quote, the totals and the installments. For the management and the
 * approvers.
 */
@Injectable()
export class PurchaseOrderPdfUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly orders: PurchaseOrderRepositoryPort,
    @Inject(PURCHASE_QUOTE_REPOSITORY)
    private readonly quotes: PurchaseQuoteRepositoryPort,
    @Inject(SUPPLIER_REPOSITORY)
    private readonly suppliers: SupplierRepositoryPort,
    private readonly listing: ListPurchaseOrdersUseCase,
    private readonly access: PurchasesAccessService,
    private readonly condominiums: CondominiumLookupService,
    @Inject(PURCHASE_ORDER_RENDERER)
    private readonly renderer: PurchaseOrderRendererPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async render(
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<PurchaseOrderFile> {
    const access = await this.access.orderAccess(actor, "money");
    const request = await this.listing.loadRequest(access, requestId);
    const order = await this.orders.findByRequest(
      access.condominiumId,
      request.id,
    );
    if (!order) {
      throw AppException.from(APP_ERRORS.purchases.orderNotFound, undefined);
    }
    const [quote, supplier, condominium] = await Promise.all([
      order.quoteId
        ? this.quotes.find(access.condominiumId, order.quoteId)
        : null,
      order.supplierId
        ? this.suppliers.find(access.condominiumId, order.supplierId)
        : null,
      this.condominiums.find(access.condominiumId),
    ]);
    const code = orderCode(order.number);
    const condominiumName = condominium?.name ?? "Condomínio";
    const input = this.input(request, order, quote, supplier, {
      name: condominiumName,
      document: condominium?.document ?? null,
      city: condominium ? `${condominium.city}/${condominium.state}` : null,
    });
    return {
      fileName: `ordem-de-compra-${code}.pdf`,
      content: await this.renderer.render(input),
      code,
      request: input.request,
      total: formatCents(order.totalCents),
      condominiumName,
    };
  }

  /** The order as text (exposed for the tests). */
  input(
    request: PurchaseRequest,
    order: PurchaseOrder,
    quote: PurchaseQuote | null,
    supplier: Supplier | null,
    condominium: { name: string; document: string | null; city: string | null },
  ): PurchaseOrderInput {
    const totals = quote
      ? quoteTotals(
          quote,
          new Map(request.items.map((item) => [item.id, item.quantity])),
        )
      : null;
    const method = order.paymentMethod
      ? order.paymentMethod === PaymentMethod.OTHER
        ? (order.paymentTerms ?? PAYMENT_METHOD_LABELS[PaymentMethod.OTHER])
        : PAYMENT_METHOD_LABELS[order.paymentMethod]
      : "A combinar";
    const count = order.installments.length;
    return {
      code: orderCode(order.number),
      request: `${requestCode(request.number)} · ${request.title}`,
      condominium: {
        name: condominium.name,
        facts: [
          [
            "CNPJ",
            condominium.document ? formatCnpj(condominium.document) : null,
          ],
          ["Cidade", condominium.city],
          ["Pedido por", order.orderedByName],
          ["Data do pedido", this.when(order.orderedAt)],
        ],
      },
      generatedAt: this.when(this.clock.now()),
      supplier: {
        name: supplier
          ? supplier.tradeName
            ? `${supplier.tradeName} (${supplier.name})`
            : supplier.name
          : order.supplierName,
        facts: supplier
          ? [
              [
                supplier.documentType === SupplierDocumentType.CNPJ
                  ? "CNPJ"
                  : "CPF",
                documentOf(supplier),
              ],
              ["Contato", supplier.contactName],
              ["Telefone", supplier.phone ? formatPhone(supplier.phone) : null],
              ["E-mail", supplier.email],
            ]
          : [],
      },
      delivery: [
        ["Local", request.location ?? condominium.name],
        [
          "Entrega prevista",
          order.expectedOn ? formatLocalDate(order.expectedOn) : "A combinar",
        ],
      ],
      items: request.items.map((item, index) => {
        const price =
          quote?.items.find((line) => line.requestItemId === item.id)
            ?.unitPriceCents ?? null;
        const what = [
          `${index + 1}. ${item.productName}`,
          item.brandName ?? "Qualquer marca",
          item.note,
        ]
          .filter(Boolean)
          .join(" · ");
        const amount = formatQuantity(item.quantity, item.unit);
        return [
          what,
          price === null
            ? amount
            : `${amount} × ${formatCents(price)} = ${formatCents(lineCents(item.quantity, price))}`,
        ];
      }),
      totals: [
        ...(totals && quote
          ? ([
              ["Itens", formatCents(totals.itemsCents)],
              ...(quote.shippingCents
                ? [["Frete", formatCents(quote.shippingCents)]]
                : []),
              ...quote.charges.map((charge) => [
                charge.label,
                formatCents(charge.amountCents),
              ]),
              ...(quote.discountCents
                ? [["Desconto", `− ${formatCents(quote.discountCents)}`]]
                : []),
              ...(totals.interestCents
                ? [["Juros do parcelamento", formatCents(totals.interestCents)]]
                : []),
            ] as [string, string][])
          : []),
        ["Total", formatCents(order.totalCents)],
      ],
      payment: [
        ["Forma", count > 1 ? `${method} · ${count} parcelas` : method],
        ...order.installments.map((installment): [string, string] => [
          count > 1 ? `Parcela ${installment.number}` : "Vencimento",
          `${formatCents(installment.amountCents)} · vence em ${formatLocalDate(installment.dueOn)}`,
        ]),
      ],
      notes: order.notes,
      signers: [
        {
          name: order.orderedByName ?? "",
          role: `Comprador · ${condominium.name}`,
        },
        { name: order.supplierName, role: "Fornecedor" },
      ],
    };
  }

  private when(date: Date): string {
    return formatLocalDate(toLocalDate(date, this.clock.timeZone));
  }
}
