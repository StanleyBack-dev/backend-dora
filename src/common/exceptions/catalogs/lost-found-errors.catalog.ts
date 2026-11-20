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
    message:
      "Descreva o item com detalhes (de 10 a 500 caracteres): cor, marca, o que tem dentro…",
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
} as const;
