import { registerEnumType } from "@nestjs/graphql";
import "@/modules/catalog/presentation/graphql/catalog.graphql-enums";
import {
  PurchasePriority,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";

registerEnumType(PurchaseRequestStatus, {
  name: "PurchaseRequestStatus",
  description:
    "Solicitação de compra: aguardando cotação, em cotação, aguardando aprovação, aprovada, pedido feito, recebida, concluída, reprovada ou cancelada.",
});

registerEnumType(PurchasePriority, {
  name: "PurchasePriority",
  description: "Prioridade de uma solicitação de compra.",
});
