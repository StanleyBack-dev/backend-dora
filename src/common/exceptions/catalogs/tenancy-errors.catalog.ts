import { HttpStatus } from "@nestjs/common";

export const tenancyErrors = {
  noCondominium: {
    code: "TENANCY_NO_CONDOMINIUM",
    status: HttpStatus.CONFLICT,
    message: "Escolha um condomínio para continuar.",
  },
  notMember: {
    code: "TENANCY_NOT_MEMBER",
    status: HttpStatus.FORBIDDEN,
    message: "Você não tem acesso a este condomínio.",
  },
  condominiumSuspended: {
    code: "TENANCY_CONDOMINIUM_SUSPENDED",
    status: HttpStatus.FORBIDDEN,
    message:
      "O acesso a este condomínio está suspenso. Fale com a administração do Dora.",
  },
} as const;
