import { HttpStatus } from "@nestjs/common";

export const platformMetricsErrors = {
  invalidPeriod: {
    code: "METRICS_INVALID_PERIOD",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Escolha um período válido: até 1 ano, sem datas futuras e com o início antes do fim.",
  },
} as const;
