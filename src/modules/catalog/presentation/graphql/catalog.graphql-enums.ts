import { registerEnumType } from "@nestjs/graphql";
import { Category } from "@/modules/catalog/domain/category";

registerEnumType(Category, {
  name: "Category",
  description:
    "Categoria de uma compra, de um fornecedor ou de outro registro (manutenção, elétrica, limpeza, alimentação…); o que não estiver na lista é OTHER, com o texto digitado.",
});
