import { HttpStatus } from "@nestjs/common";

export const purchasesErrors = {
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
};
