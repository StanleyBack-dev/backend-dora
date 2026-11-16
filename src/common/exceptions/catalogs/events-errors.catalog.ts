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
  paymentSetupMissing: {
    code: "EVENT_PAYMENT_SETUP_MISSING",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Este evento cobra pelo PIX do condomínio, que ainda não foi cadastrado. Cadastre o PIX do condomínio ou informe outro PIX no evento.",
  },
  notOnSale: {
    code: "EVENT_NOT_ON_SALE",
    status: HttpStatus.CONFLICT,
    message:
      "Este evento não está aceitando pedidos (já começou ou foi cancelado).",
  },
  orderInvalid: {
    code: "EVENT_ORDER_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  full: {
    code: "EVENT_FULL",
    status: HttpStatus.CONFLICT,
    message: "Não há mais vagas para tantas pessoas neste evento.",
  },
  outsideFull: {
    code: "EVENT_OUTSIDE_FULL",
    status: HttpStatus.CONFLICT,
    message: "Não há mais vagas para convidados de fora do condomínio.",
  },
  alreadyHeld: {
    code: "EVENT_ALREADY_HELD",
    status: HttpStatus.CONFLICT,
    message: (params: { reason: string }) => params.reason,
  },
  unitLimit: {
    code: "EVENT_UNIT_LIMIT",
    status: HttpStatus.CONFLICT,
    message: (params: { limit: number }) =>
      `Cada unidade pode ter até ${params.limit} ingressos neste evento.`,
  },
  orderNotFound: {
    code: "EVENT_ORDER_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Pedido não encontrado.",
  },
  orderNotPending: {
    code: "EVENT_ORDER_NOT_PENDING",
    status: HttpStatus.CONFLICT,
    message:
      "Este pedido não está mais aguardando pagamento (o prazo pode ter acabado).",
  },
  invalidReceipt: {
    code: "EVENT_INVALID_RECEIPT",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Envie o comprovante como imagem (JPG, PNG ou WebP) ou PDF, com até 1,2 MB.",
  },
  proofNotNeeded: {
    code: "EVENT_PROOF_NOT_NEEDED",
    status: HttpStatus.CONFLICT,
    message: "Esta pessoa não precisa enviar documento.",
  },
  invalidProof: {
    code: "EVENT_INVALID_PROOF",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Envie o documento como imagem (JPG, PNG ou WebP) ou PDF, com até 1,2 MB.",
  },
  orderNotUnderReview: {
    code: "EVENT_ORDER_NOT_UNDER_REVIEW",
    status: HttpStatus.CONFLICT,
    message: "Este pedido não está aguardando conferência.",
  },
  invalidRejectReason: {
    code: "EVENT_INVALID_REJECT_REASON",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe o motivo da recusa (3 a 300 caracteres).",
  },
} as const;
