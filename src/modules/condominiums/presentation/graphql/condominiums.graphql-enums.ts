import { registerEnumType } from "@nestjs/graphql";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import {
  AddressFormat,
  CondominiumStatus,
} from "@/modules/condominiums/domain/condominium";

registerEnumType(CondominiumStatus, {
  name: "CondominiumStatus",
  description: "Situação do condomínio na plataforma.",
});

registerEnumType(AddressFormat, {
  name: "AddressFormat",
  description:
    "Como as moradias são identificadas: apartamentos (bloco e número) ou casas (rua, quadra e lote).",
});

registerEnumType(AppModule, {
  name: "AppModule",
  description: "Módulos contratados à parte pelo condomínio.",
});
