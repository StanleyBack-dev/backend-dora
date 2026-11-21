import { registerEnumType } from "@nestjs/graphql";
import { LocationStatus } from "@/shared/domain/signature/signature-capture";

// Shared by every module that collects an on-screen signature (parcels,
// lost and found): registered once, imported for its side effect.
registerEnumType(LocationStatus, {
  name: "SignatureLocationStatus",
  description:
    "Localização do aparelho na assinatura: obtida, recusada ou indisponível.",
});
