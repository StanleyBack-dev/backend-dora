import { HttpStatus } from "@nestjs/common";

export const parcelsErrors = {
  invalid: {
    code: "PARCEL_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  notFound: {
    code: "PARCEL_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Encomenda não encontrada.",
  },
  codeNotFound: {
    code: "PARCEL_CODE_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message:
      "Nenhuma encomenda com este código neste condomínio. Confira o código com o morador.",
  },
  unitNotFound: {
    code: "PARCEL_UNIT_NOT_FOUND",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Escolha uma unidade deste condomínio.",
  },
  notWaiting: {
    code: "PARCEL_NOT_WAITING",
    status: HttpStatus.CONFLICT,
    message: (params: { reason: string }) => params.reason,
  },
  invalidPhoto: {
    code: "PARCEL_INVALID_PHOTO",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Envie uma foto JPEG, PNG ou WebP de até 1 MB.",
  },
  noReceipt: {
    code: "PARCEL_NO_RECEIPT",
    status: HttpStatus.CONFLICT,
    message: "Esta encomenda ainda não foi retirada: não há comprovante.",
  },
  invalidSignature: {
    code: "PARCEL_INVALID_SIGNATURE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "A assinatura não foi reconhecida. Peça para assinar de novo, com o dedo ou a caneta, ocupando boa parte do quadro.",
  },
  invalidSigner: {
    code: "PARCEL_INVALID_SIGNER",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  invalidReason: {
    code: "PARCEL_INVALID_REASON",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe o motivo (3 a 300 caracteres).",
  },
} as const;
