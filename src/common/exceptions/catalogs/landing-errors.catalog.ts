import { HttpStatus } from "@nestjs/common";

/** "15 min", "2 h", "24 h". */
export function waitLabel(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${Math.ceil(minutes / 60)} h`;
}

export const landingErrors = {
  invalidLead: {
    code: "LANDING_LEAD_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  tooManyLeads: {
    code: "LANDING_TOO_MANY_LEADS",
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: (params: { minutes: number }) =>
      `Recebemos várias mensagens suas agora há pouco. Tente de novo em ${waitLabel(params.minutes)} ou fale pelo WhatsApp.`,
  },
} as const;
