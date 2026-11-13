import { registerEnumType } from "@nestjs/graphql";
import {
  SupportCategory,
  SupportStatus,
} from "@/modules/support/domain/support-request";

registerEnumType(SupportCategory, {
  name: "SupportCategory",
  description: "Do que se trata a solicitação de suporte.",
});
registerEnumType(SupportStatus, {
  name: "SupportStatus",
  description: "Aberto → respondido → finalizado.",
});
