import { HttpStatus } from "@nestjs/common";

export const catalogErrors = {
  productNotFound: {
    code: "PRODUCT_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Produto não encontrado neste condomínio.",
  },
  productInvalid: {
    code: "PRODUCT_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  productNameTaken: {
    code: "PRODUCT_NAME_TAKEN",
    status: HttpStatus.CONFLICT,
    message:
      "Já existe um produto com este nome no condomínio (ele pode estar inativo: a gestão pode reativá-lo em Compras > Produtos).",
  },
  brandNotFound: {
    code: "BRAND_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Marca não encontrada neste condomínio.",
  },
  brandInvalid: {
    code: "BRAND_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "O nome da marca deve ter de 2 a 60 caracteres.",
  },
  brandNameTaken: {
    code: "BRAND_NAME_TAKEN",
    status: HttpStatus.CONFLICT,
    message:
      "Já existe uma marca com este nome no condomínio (ela pode estar inativa: a gestão pode reativá-la em Compras > Marcas).",
  },
};
