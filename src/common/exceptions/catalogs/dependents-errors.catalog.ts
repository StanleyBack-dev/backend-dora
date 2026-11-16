import { HttpStatus } from "@nestjs/common";

export const dependentsErrors = {
  noMembership: {
    code: "DEPENDENT_NO_MEMBERSHIP",
    status: HttpStatus.FORBIDDEN,
    message: "Só moradores do condomínio cadastram dependentes.",
  },
  invalid: {
    code: "DEPENDENT_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  tooMany: {
    code: "DEPENDENT_TOO_MANY",
    status: HttpStatus.CONFLICT,
    message: "Você já tem 15 dependentes cadastrados.",
  },
  invalidDocument: {
    code: "DEPENDENT_INVALID_DOCUMENT",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Envie o documento como imagem (JPG, PNG ou WebP) ou PDF, com até 1,2 MB.",
  },
  notFound: {
    code: "DEPENDENT_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Dependente não encontrado.",
  },
  notPending: {
    code: "DEPENDENT_NOT_PENDING",
    status: HttpStatus.CONFLICT,
    message: "Este dependente não está mais aguardando aprovação.",
  },
  invalidReason: {
    code: "DEPENDENT_INVALID_REASON",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe o motivo da recusa (3 a 300 caracteres).",
  },
} as const;
