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
  hasBookings: {
    code: "SPACE_HAS_BOOKINGS",
    status: HttpStatus.CONFLICT,
    message:
      "Este espaço já tem reservas. Para tirá-lo de uso, desative-o: o histórico fica guardado.",
  },
  photoLimit: {
    code: "SPACE_PHOTO_LIMIT",
    status: HttpStatus.CONFLICT,
    message:
      "Cada espaço pode ter até 3 fotos. Remova uma para adicionar outra.",
  },
  invalidPhoto: {
    code: "SPACE_INVALID_PHOTO",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "A foto deve ser uma imagem JPEG, PNG ou WebP de até 1,2 MB (o app reduz a foto antes de enviar).",
  },
  photoNotFound: {
    code: "SPACE_PHOTO_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Foto não encontrada neste espaço.",
  },
  nameTaken: {
    code: "SPACE_NAME_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "Já existe um espaço com este nome no condomínio.",
  },
} as const;
