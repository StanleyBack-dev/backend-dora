import { registerEnumType } from "@nestjs/graphql";
import { CondominiumStatus } from "@/modules/condominiums/domain/condominium";

registerEnumType(CondominiumStatus, {
  name: "CondominiumStatus",
  description: "Situação do condomínio na plataforma.",
});
