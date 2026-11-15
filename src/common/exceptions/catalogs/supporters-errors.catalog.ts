import { HttpStatus } from "@nestjs/common";

export const supportersErrors = {
  invalidContribution: {
    code: "SUPPORTERS_INVALID_CONTRIBUTION",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  supporterNotFound: {
    code: "SUPPORTERS_SUPPORTER_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Apoiador não encontrado.",
  },
  contributionNotFound: {
    code: "SUPPORTERS_CONTRIBUTION_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Apoio não encontrado.",
  },
  nameTaken: {
    code: "SUPPORTERS_NAME_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "Já existe um apoiador com esse nome.",
  },
  invalidYear: {
    code: "SUPPORTERS_INVALID_YEAR",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Escolha um ano entre 2020 e o ano atual.",
  },
} as const;
