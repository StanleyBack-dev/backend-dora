import { HttpStatus } from "@nestjs/common";

export const purchasesErrors = {
  shareLimit: {
    code: "PURCHASE_SHARE_LIMIT",
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: (params: { minutes: number }) =>
      `Muitos envios em pouco tempo. Tente de novo em ${params.minutes} minuto(s).`,
  },
  spaceUnavailable: {
    code: "PURCHASE_SPACE_UNAVAILABLE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "O espaço escolhido não está mais disponível. Escolha outro ou digite o local.",
  },
  catalogUnavailable: {
    code: "PURCHASE_CATALOG_UNAVAILABLE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Um dos produtos ou marcas escolhidos não está mais disponível. Escolha outro (ou deixe “Qualquer marca”).",
  },
  quoteNotFound: {
    code: "PURCHASE_QUOTE_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Cotação não encontrada neste condomínio.",
  },
  quoteInvalid: {
    code: "PURCHASE_QUOTE_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  quoteInvalidFile: {
    code: "PURCHASE_QUOTE_INVALID_FILE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "O orçamento deve ser um PDF ou uma imagem (JPEG, PNG ou WebP) de até 1,2 MB.",
  },
  quoteSupplierTaken: {
    code: "PURCHASE_QUOTE_SUPPLIER_TAKEN",
    status: HttpStatus.CONFLICT,
    message:
      "Este fornecedor já tem uma cotação nesta solicitação. Edite a cotação dele.",
  },
  quoteSupplierUnavailable: {
    code: "PURCHASE_QUOTE_SUPPLIER_UNAVAILABLE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "O fornecedor escolhido não está ativo neste condomínio.",
  },
  quotesLocked: {
    code: "PURCHASE_QUOTES_LOCKED",
    status: HttpStatus.CONFLICT,
    message:
      "As cotações desta solicitação não podem mais ser alteradas (ela já tem uma cotação escolhida ou foi encerrada).",
  },
  justificationRequired: {
    code: "PURCHASE_QUOTE_JUSTIFICATION_REQUIRED",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Justifique a escolha (de 3 a 300 caracteres): ela não é a cotação completa mais barata ou há menos de 3 cotações.",
  },
  requestNotFound: {
    code: "PURCHASE_REQUEST_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Solicitação de compra não encontrada neste condomínio.",
  },
  requestInvalid: {
    code: "PURCHASE_REQUEST_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  requestLocked: {
    code: "PURCHASE_REQUEST_LOCKED",
    status: HttpStatus.CONFLICT,
    message:
      "Esta solicitação já está em cotação ou foi encerrada: ela não pode mais ser alterada nem cancelada.",
  },
  requestScopeLocked: {
    code: "PURCHASE_REQUEST_SCOPE_LOCKED",
    status: HttpStatus.CONFLICT,
    message:
      "Em cotação, só dá para mudar a prioridade, o local e a data: o título, os detalhes, os itens e as categorias ficam como estão.",
  },
};
