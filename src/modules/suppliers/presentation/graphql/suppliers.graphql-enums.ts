import { registerEnumType } from "@nestjs/graphql";
import "@/common/graphql/pix-key-type.enum";
import "@/modules/catalog/presentation/graphql/catalog.graphql-enums";
import { SupplierDocumentType } from "@/modules/suppliers/domain/supplier";

registerEnumType(SupplierDocumentType, {
  name: "SupplierDocumentType",
  description: "Fornecedor com CNPJ (empresa) ou CPF (autônomo).",
});
