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
  // --- weekly series ---
  recurringNotAllowed: {
    code: "BOOKING_RECURRING_NOT_ALLOWED",
    status: HttpStatus.FORBIDDEN,
    message:
      "Este espaço não aceita reservas recorrentes de moradores. Fale com a administração.",
  },
  invalidSeries: {
    code: "BOOKING_INVALID_SERIES",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Escolha de 2 a 26 semanas.",
  },
  seriesNotFound: {
    code: "BOOKING_SERIES_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Reserva recorrente não encontrada.",
  },
  // --- guests ---
  guestsNotAllowed: {
    code: "BOOKING_GUESTS_NOT_ALLOWED",
    status: HttpStatus.FORBIDDEN,
    message: "Este espaço não aceita lista de convidados.",
  },
  tooManyGuests: {
    code: "BOOKING_TOO_MANY_GUESTS",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { max: number }) =>
      `Este espaço aceita até ${params.max} convidado${params.max === 1 ? "" : "s"} por reserva.`,
  },
  invalidGuest: {
    code: "BOOKING_INVALID_GUEST",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  guestsClosed: {
    code: "BOOKING_GUESTS_CLOSED",
    status: HttpStatus.CONFLICT,
    message:
      "A lista de convidados só muda enquanto a reserva está ativa e não terminou.",
  },
  guestNotFound: {
    code: "BOOKING_GUEST_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Convidado não encontrado.",
  },
  checkInDenied: {
    code: "BOOKING_CHECK_IN_DENIED",
    status: HttpStatus.CONFLICT,
    message: (params: { reason: string }) => params.reason,
  },
  // --- waiting list ---
  waitlistNotTaken: {
    code: "BOOKING_WAITLIST_NOT_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "Este horário está livre: reserve direto.",
  },
  // --- fees ---
  invalidMonth: {
    code: "BOOKING_INVALID_MONTH",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Mês inválido.",
  },
} as const;
