import { registerEnumType } from "@nestjs/graphql";
import "@/common/graphql/pix-key-type.enum";
import { PurchaseCategory } from "@/modules/purchases/domain/purchase-category";
import { SupplierDocumentType } from "@/modules/purchases/domain/supplier";

registerEnumType(PurchaseCategory, {
  name: "PurchaseCategory",
  description:
    "Categoria de uma compra ou do que um fornecedor atende (manutenção, elétrica, limpeza, alimentação…); o que não estiver na lista é OTHER, com o texto digitado.",
});

registerEnumType(SupplierDocumentType, {
  name: "SupplierDocumentType",
  description: "Fornecedor com CNPJ (empresa) ou CPF (autônomo).",
});
