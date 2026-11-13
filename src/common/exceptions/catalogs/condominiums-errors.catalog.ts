import { HttpStatus } from "@nestjs/common";

export const condominiumsErrors = {
  notFound: {
    code: "CONDOMINIUM_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Condomínio não encontrado.",
  },
  invalid: {
    code: "CONDOMINIUM_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  documentTaken: {
    code: "CONDOMINIUM_DOCUMENT_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "Já existe um condomínio com este CNPJ.",
  },
  unitNotFound: {
    code: "UNIT_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Unidade não encontrada neste condomínio.",
  },
  unitInvalid: {
    code: "UNIT_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  unitTaken: {
    code: "UNIT_TAKEN",
    status: HttpStatus.CONFLICT,
    message: (params: { labels: string }) =>
      `Estas unidades já existem: ${params.labels}.`,
  },
  unitInUse: {
    code: "UNIT_IN_USE",
    status: HttpStatus.CONFLICT,
    message:
      "Esta unidade tem moradores vinculados. Mude a unidade deles antes de excluí-la.",
  },
} as const;
