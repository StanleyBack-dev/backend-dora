import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { PaymentMethod } from "@/modules/purchases/domain/purchase-quote";
import { PurchaseRequestType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-request.output";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";

@ObjectType("PurchaseReceiptItem", {
  description: "O que chegou de um item numa entrega.",
})
export class PurchaseReceiptItemType {
  @Field(() => ID)
  requestItemId!: string;

  @Field(() => Float)
  quantity!: number;
}

@ObjectType("PurchaseReceipt", {
  description: "Uma entrega do pedido (toda ou em parte), com a nota fiscal.",
})
export class PurchaseReceiptType {
  @Field(() => ID)
  id!: string;

  @Field({ description: "O dia em que chegou (AAAA-MM-DD)." })
  receivedOn!: string;

  @Field(() => [PurchaseReceiptItemType])
  items!: PurchaseReceiptItemType[];

  @Field(() => String, { nullable: true })
  invoiceNumber!: string | null;

  @Field(() => Float, {
    nullable: true,
    description: "Valor da nota em centavos (null: não informado ou oculto).",
  })
  invoiceCents!: number | null;

  @Field(() => String, { nullable: true })
  invoiceDate!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Link temporário da nota fiscal (null: sem arquivo).",
  })
  fileUrl!: string | null;

  @Field(() => Boolean, { nullable: true })
  fileIsPdf!: boolean | null;

  @Field(() => String, { nullable: true })
  note!: string | null;

  @Field(() => ID, { nullable: true })
  receivedById!: string | null;

  @Field(() => String, { nullable: true })
  receivedByName!: string | null;

  @Field()
  createdAt!: Date;
}

@ObjectType("PurchaseInstallment", {
  description: "Uma parcela a pagar ao fornecedor (ou o pagamento à vista).",
})
export class PurchaseInstallmentType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  number!: number;

  @Field(() => Float, { description: "Em centavos." })
  amountCents!: number;

  @Field()
  dueOn!: string;

  @Field(() => String, { nullable: true, description: "null: não paga." })
  paidOn!: string | null;

  @Field(() => String, { nullable: true })
  paidByName!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Link temporário do comprovante (null: sem arquivo).",
  })
  proofUrl!: string | null;

  @Field(() => Boolean, { nullable: true })
  proofIsPdf!: boolean | null;

  @Field(() => String, { nullable: true })
  note!: string | null;
}

@ObjectType("PurchaseOrderRating", {
  description: "A avaliação do fornecedor nesta compra.",
})
export class PurchaseOrderRatingType {
  @Field(() => Int, { description: "De 1 a 5." })
  rating!: number;

  @Field(() => String, { nullable: true })
  comment!: string | null;

  @Field(() => String, { nullable: true })
  ratedByName!: string | null;

  @Field()
  ratedAt!: Date;
}

@ObjectType("PurchaseOrder", {
  description:
    "A ordem de compra (OC) de uma compra aprovada, com as entregas e as parcelas.",
})
export class PurchaseOrderType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int, { description: "Sequencial no condomínio (OC-0001)." })
  number!: number;

  @Field()
  supplierName!: string;

  @Field(() => String, {
    nullable: true,
    description: "Para enviar o pedido (null: sem e-mail ou oculto).",
  })
  supplierEmail!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Para o WhatsApp (null: sem telefone ou oculto).",
  })
  supplierPhone!: string | null;

  @Field(() => Float, { nullable: true, description: "null: oculto." })
  itemsCents!: number | null;

  @Field(() => Float, { nullable: true, description: "null: oculto." })
  totalCents!: number | null;

  @Field(() => PaymentMethod, { nullable: true })
  paymentMethod!: PaymentMethod | null;

  @Field(() => String, { nullable: true })
  paymentTerms!: string | null;

  @Field(() => String, { nullable: true })
  expectedOn!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => String, { nullable: true })
  orderedByName!: string | null;

  @Field()
  orderedAt!: Date;

  @Field(() => Date, { nullable: true })
  completedAt!: Date | null;

  @Field(() => [PurchaseReceiptType])
  receipts!: PurchaseReceiptType[];

  @Field(() => [PurchaseInstallmentType], {
    description: "Vazio para quem não vê os valores.",
  })
  installments!: PurchaseInstallmentType[];

  @Field(() => PurchaseOrderRatingType, { nullable: true })
  rating!: PurchaseOrderRatingType | null;
}

@ObjectType("PurchaseOrderLine", {
  description: "Um item da compra e como está a entrega dele.",
})
export class PurchaseOrderLineType {
  @Field(() => ID)
  requestItemId!: string;

  @Field()
  productName!: string;

  @Field(() => String, { nullable: true })
  brandName!: string | null;

  @Field(() => String, { nullable: true })
  note!: string | null;

  @Field()
  unit!: string;

  @Field(() => Float)
  quantity!: number;

  @Field(() => Float, { description: "Quanto já chegou." })
  received!: number;

  @Field(() => Float, { description: "Quanto falta chegar." })
  pending!: number;

  @Field(() => Float, { nullable: true })
  unitPriceCents!: number | null;

  @Field(() => Float, { nullable: true })
  lineCents!: number | null;
}

@ObjectType("PurchaseOrderPlan", {
  description:
    "Como fica o pedido de uma compra aprovada (da cotação escolhida).",
})
export class PurchaseOrderPlanType {
  @Field()
  supplierName!: string;

  @Field(() => Float)
  itemsCents!: number;

  @Field(() => Float)
  totalCents!: number;

  @Field(() => PaymentMethod, { nullable: true })
  paymentMethod!: PaymentMethod | null;

  @Field(() => String, { nullable: true })
  paymentTerms!: string | null;

  @Field(() => Int, { nullable: true })
  deliveryDays!: number | null;

  @Field(() => [Float], { description: "Cada parcela (uma: à vista)." })
  installmentValues!: number[];
}

@ObjectType("CancelledPurchaseOrder", {
  description: "Um pedido cancelado antes de chegar ou ser pago algo.",
})
export class CancelledPurchaseOrderType {
  @Field(() => Int)
  number!: number;

  @Field()
  supplierName!: string;

  @Field(() => Float, { nullable: true, description: "null: oculto." })
  totalCents!: number | null;

  @Field()
  orderedAt!: Date;

  @Field()
  cancelledAt!: Date;

  @Field(() => String, { nullable: true })
  cancelledByName!: string | null;

  @Field()
  reason!: string;
}

@ObjectType("PurchaseOrderView", {
  description: "A página do pedido de uma compra.",
})
export class PurchaseOrderViewType {
  @Field(() => PurchaseRequestType)
  request!: PurchaseRequestType;

  @Field(() => PurchaseOrderType, {
    nullable: true,
    description: "null: aprovada, o pedido ainda por fazer.",
  })
  order!: PurchaseOrderType | null;

  @Field(() => [PurchaseOrderLineType])
  lines!: PurchaseOrderLineType[];

  @Field(() => PurchaseOrderPlanType, { nullable: true })
  plan!: PurchaseOrderPlanType | null;

  @Field(() => [CancelledPurchaseOrderType], {
    description: "Pedidos cancelados antes, do mais recente.",
  })
  cancelledOrders!: CancelledPurchaseOrderType[];

  @Field({ description: "Faz o pedido, paga, avalia e desfaz." })
  canManage!: boolean;

  @Field({ description: "Vê os valores." })
  canSeeMoney!: boolean;
}

@ObjectType("OrderBoardRow", {
  description: "Uma compra na página de pedidos.",
})
export class OrderBoardRowType {
  @Field(() => PurchaseRequestType)
  request!: PurchaseRequestType;

  @Field(() => Int, { nullable: true, description: "null: pedido por fazer." })
  orderNumber!: number | null;

  @Field(() => String, { nullable: true })
  supplierName!: string | null;

  @Field(() => Float, { nullable: true, description: "null: oculto." })
  totalCents!: number | null;

  @Field(() => String, { nullable: true })
  expectedOn!: string | null;

  @Field(() => Int, { description: "Itens que já chegaram por completo." })
  itemsReceived!: number;

  @Field(() => Int)
  itemCount!: number;

  @Field(() => Int, { description: "Entregas registradas (parciais ou não)." })
  receiptCount!: number;

  @Field(() => Int)
  installmentsPaid!: number;

  @Field(() => Int)
  installmentCount!: number;

  @Field(() => String, {
    nullable: true,
    description: "O vencimento da próxima parcela em aberto.",
  })
  nextDueOn!: string | null;
}

export const OrderBoardPage = Paginated(OrderBoardRowType, "OrderBoardPage");

@ObjectType("OrderBoardOverview", {
  description: "Os pedidos em números (os cards da página).",
})
export class OrderBoardOverviewType {
  @Field(() => Int, { description: "Aprovadas, o pedido por fazer." })
  toOrder!: number;

  @Field(() => Int, { description: "Pedido feito, aguardando a entrega." })
  awaitingDelivery!: number;

  @Field(() => Int, { description: "Parcelas em aberto." })
  unpaidInstallments!: number;

  @Field(() => Float, { description: "Soma das parcelas em aberto." })
  unpaidCents!: number;

  @Field(() => Int, { description: "Parcelas vencidas." })
  overdueInstallments!: number;

  @Field(() => Int, { description: "Concluídas neste mês." })
  completedThisMonth!: number;
}

@ObjectType("PurchaseOrderFile", {
  description: "A ordem de compra em PDF.",
})
export class PurchaseOrderFileType {
  @Field({ description: "Nome sugerido do arquivo." })
  fileName!: string;

  @Field({ description: "application/pdf" })
  mimeType!: string;

  @Field({ description: "O PDF em base64." })
  base64Content!: string;
}

@ObjectType("DeliveryBoardOverview", {
  description: "As entregas em números (os cards da página de recebimentos).",
})
export class DeliveryBoardOverviewType {
  @Field(() => Int, { description: "Pedidos aguardando a entrega." })
  awaitingDelivery!: number;

  @Field(() => Int, { description: "Destes, com a entrega prevista vencida." })
  lateDeliveries!: number;

  @Field(() => Int, { description: "Destes, com parte já entregue." })
  partialDeliveries!: number;

  @Field(() => Int, { description: "Entregas registradas neste mês." })
  receiptsThisMonth!: number;
}
