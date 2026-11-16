import { HttpStatus } from "@nestjs/common";

export const eventsErrors = {
  invalid: {
    code: "EVENT_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  notFound: {
    code: "EVENT_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Evento não encontrado.",
  },
  spaceNotFound: {
    code: "EVENT_SPACE_NOT_FOUND",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Escolha um espaço deste condomínio.",
  },
  closed: {
    code: "EVENT_CLOSED",
    status: HttpStatus.CONFLICT,
    message: "Este evento já terminou ou foi cancelado: não pode mais mudar.",
  },
  alreadyPublished: {
    code: "EVENT_ALREADY_PUBLISHED",
    status: HttpStatus.CONFLICT,
    message: "Este evento já foi publicado.",
  },
  invalidReason: {
    code: "EVENT_INVALID_REASON",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe o motivo do cancelamento (3 a 400 caracteres).",
  },
} as const;
