import { HttpStatus } from "@nestjs/common";

export const purchasesErrors = {
  supplierNotFound: {
    code: "SUPPLIER_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Fornecedor não encontrado neste condomínio.",
  },
  supplierInvalid: {
    code: "SUPPLIER_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  supplierDocumentTaken: {
    code: "SUPPLIER_DOCUMENT_TAKEN",
    status: HttpStatus.CONFLICT,
    message:
      "Já existe um fornecedor com este CNPJ/CPF no condomínio. Procure por ele na lista (ele pode estar inativo).",
  },
};
