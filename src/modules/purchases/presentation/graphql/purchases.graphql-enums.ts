import { registerEnumType } from "@nestjs/graphql";
import "@/modules/catalog/presentation/graphql/catalog.graphql-enums";
import {
  ApprovalDecision,
  ApprovalMode,
} from "@/modules/purchases/domain/purchase-approval";
import { PaymentMethod } from "@/modules/purchases/domain/purchase-quote";
import {
  PurchasePriority,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";

registerEnumType(PurchaseRequestStatus, {
  name: "PurchaseRequestStatus",
  description:
    "Solicitação de compra: aguardando cotação, em cotação, aguardando aprovação, aprovada, pedido feito, recebida, concluída, reprovada ou cancelada.",
});

registerEnumType(PaymentMethod, {
  name: "PaymentMethod",
  description:
    "Forma de pagamento de uma cotação: PIX, dinheiro, cartão de débito ou de crédito, boleto, transferência, faturado ou outra (digitada).",
});

registerEnumType(ApprovalMode, {
  name: "PurchaseApprovalMode",
  description:
    "Como o condomínio aprova as compras: toda compra passa pelo aprovador (ALWAYS) ou, até o limite (alçada), segue aprovada ao escolher a cotação (LIMIT).",
});

registerEnumType(ApprovalDecision, {
  name: "PurchaseApprovalDecision",
  description:
    "Decisão sobre uma compra: aprovada na alçada (ao escolher), aprovada, devolvida para cotação ou reprovada.",
});

registerEnumType(PurchasePriority, {
  name: "PurchasePriority",
  description: "Prioridade de uma solicitação de compra.",
});
