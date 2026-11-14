import { HttpStatus } from "@nestjs/common";

export const spacesErrors = {
  notFound: {
    code: "SPACE_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Espaço não encontrado neste condomínio.",
  },
  invalid: {
    code: "SPACE_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  nameTaken: {
    code: "SPACE_NAME_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "Já existe um espaço com este nome no condomínio.",
  },
} as const;
