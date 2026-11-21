import { HttpStatus } from "@nestjs/common";

export const lostFoundErrors = {
  invalid: {
    code: "FOUND_ITEM_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  notFound: {
    code: "FOUND_ITEM_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Item não encontrado.",
  },
  notKept: {
    code: "FOUND_ITEM_NOT_KEPT",
    status: HttpStatus.CONFLICT,
    message: "Este item já foi devolvido, doado ou descartado.",
  },
  invalidPhoto: {
    code: "FOUND_ITEM_INVALID_PHOTO",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Use uma foto JPEG, PNG ou WebP de até 1 MB.",
  },
  claimNotFound: {
    code: "FOUND_ITEM_CLAIM_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Pedido não encontrado.",
  },
  claimExists: {
    code: "FOUND_ITEM_CLAIM_EXISTS",
    status: HttpStatus.CONFLICT,
    message:
      "Você já pediu este item: aguarde a resposta da portaria ou da administração.",
  },
  claimNotPending: {
    code: "FOUND_ITEM_CLAIM_NOT_PENDING",
    status: HttpStatus.CONFLICT,
    message: "Este pedido já foi respondido.",
  },
  invalidClaim: {
    code: "FOUND_ITEM_INVALID_CLAIM",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "A descrição do item pode ter até 500 caracteres.",
  },
  notReserved: {
    code: "FOUND_ITEM_NOT_RESERVED",
    status: HttpStatus.CONFLICT,
    message: "Este item não está mais reservado.",
  },
  ownClaim: {
    code: "FOUND_ITEM_OWN_CLAIM",
    status: HttpStatus.FORBIDDEN,
    message:
      "Este item é seu (você pediu ou ele foi reservado para você): outra pessoa da portaria ou da gestão precisa conferir e entregar.",
  },
  invalidNote: {
    code: "FOUND_ITEM_INVALID_NOTE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe o motivo (de 3 a 300 caracteres).",
  },
  invalidSignature: {
    code: "FOUND_ITEM_INVALID_SIGNATURE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "A assinatura não foi reconhecida. Peça para assinar de novo, com o dedo ou a caneta, ocupando boa parte do quadro.",
  },
  invalidSigner: {
    code: "FOUND_ITEM_INVALID_SIGNER",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  declarationChanged: {
    code: "FOUND_ITEM_DECLARATION_CHANGED",
    status: HttpStatus.CONFLICT,
    message:
      "Os dados do item mudaram enquanto a tela estava aberta. Abra o item de novo e peça para assinar outra vez.",
  },
  noReceipt: {
    code: "FOUND_ITEM_NO_RECEIPT",
    status: HttpStatus.CONFLICT,
    message: "Este item ainda não foi devolvido: não há comprovante.",
  },
  reportNotFound: {
    code: "LOST_REPORT_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Aviso de item perdido não encontrado.",
  },
  reportClosed: {
    code: "LOST_REPORT_CLOSED",
    status: HttpStatus.CONFLICT,
    message: "Este aviso já foi encerrado.",
  },
} as const;
