import { registerEnumType } from "@nestjs/graphql";
import { PixKeyType } from "@/shared/domain/pix";

// Shared by every PIX input and output (condominium and events).
registerEnumType(PixKeyType, {
  name: "PixKeyType",
  description: "Tipo da chave PIX: CPF, CNPJ, celular, e-mail ou aleatória.",
});
