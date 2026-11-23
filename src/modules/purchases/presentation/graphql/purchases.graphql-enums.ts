import { registerEnumType } from "@nestjs/graphql";
import "@/modules/catalog/presentation/graphql/catalog.graphql-enums";
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

registerEnumType(PurchasePriority, {
  name: "PurchasePriority",
  description: "Prioridade de uma solicitação de compra.",
});
