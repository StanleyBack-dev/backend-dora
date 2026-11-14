import { HttpStatus } from "@nestjs/common";

export const bookingsErrors = {
  notFound: {
    code: "BOOKING_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Reserva não encontrada.",
  },
  spaceUnavailable: {
    code: "BOOKING_SPACE_UNAVAILABLE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Este espaço não está disponível para reservas.",
  },
  notASlot: {
    code: "BOOKING_NOT_A_SLOT",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Escolha um dos horários disponíveis do espaço.",
  },
  past: {
    code: "BOOKING_PAST",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Este horário já passou.",
  },
  tooSoon: {
    code: "BOOKING_TOO_SOON",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { hours: number }) =>
      `Este espaço precisa ser reservado com pelo menos ${params.hours} hora(s) de antecedência.`,
  },
  tooFar: {
    code: "BOOKING_TOO_FAR",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { days: number }) =>
      `A agenda deste espaço abre só para os próximos ${params.days} dia(s).`,
  },
  slotTaken: {
    code: "BOOKING_SLOT_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "Alguém acabou de reservar este horário. Escolha outro.",
  },
  blocked: {
    code: "BOOKING_BLOCKED",
    status: HttpStatus.CONFLICT,
    message: (params: { reason: string }) =>
      `O espaço está bloqueado neste horário: ${params.reason}.`,
  },
  unitRequired: {
    code: "BOOKING_UNIT_REQUIRED",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Para reservar, você precisa estar vinculado a uma unidade. Fale com a administração do condomínio.",
  },
  unitLimit: {
    code: "BOOKING_UNIT_LIMIT",
    status: HttpStatus.CONFLICT,
    message: (params: { count: number; period: string }) =>
      `Sua unidade já atingiu o limite de ${params.count} reserva(s) ${params.period} neste espaço.`,
  },
  invalidText: {
    code: "BOOKING_INVALID_TEXT",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  cannotCancel: {
    code: "BOOKING_CANNOT_CANCEL",
    status: HttpStatus.CONFLICT,
    message: (params: { reason: string }) => params.reason,
  },
  notPending: {
    code: "BOOKING_NOT_PENDING",
    status: HttpStatus.CONFLICT,
    message: "Esta reserva não está mais aguardando aprovação.",
  },
  blockInvalid: {
    code: "BOOKING_BLOCK_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  blockOverlaps: {
    code: "BOOKING_BLOCK_OVERLAPS",
    status: HttpStatus.CONFLICT,
    message: (params: { count: number }) =>
      `Há ${params.count} reserva(s) ativa(s) neste período. Confirme para bloquear e cancelá-las (os moradores são avisados).`,
  },
  blockNotFound: {
    code: "BOOKING_BLOCK_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Bloqueio não encontrado.",
  },
} as const;
