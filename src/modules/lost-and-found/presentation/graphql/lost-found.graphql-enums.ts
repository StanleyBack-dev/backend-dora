import { registerEnumType } from "@nestjs/graphql";
import "@/common/graphql/signature.graphql-enums";
import {
  ClaimStatus,
  FoundItemCategory,
  FoundItemStatus,
} from "@/modules/lost-and-found/domain/found-item";
import { LostReportStatus } from "@/modules/lost-and-found/domain/lost-report";

registerEnumType(FoundItemStatus, {
  name: "FoundItemStatus",
  description: "Guardado, devolvido ao dono, doado ou descartado.",
});

registerEnumType(FoundItemCategory, {
  name: "FoundItemCategory",
  description: "O tipo do item achado.",
});

registerEnumType(ClaimStatus, {
  name: "FoundItemClaimStatus",
  description: "Pedido aguardando, aceito, recusado ou cancelado pelo morador.",
});

registerEnumType(LostReportStatus, {
  name: "LostReportStatus",
  description:
    "Aviso de item perdido: procurando, encontrado, cancelado ou encerrado sem notícias.",
});
