import { HttpStatus } from "@nestjs/common";

export const storageErrors = {
  notConfigured: {
    code: "STORAGE_NOT_CONFIGURED",
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message:
      "Armazenamento de arquivos não configurado (variáveis AWS_* do Neon Object Storage).",
  },
  failure: {
    code: "STORAGE_FAILURE",
    status: HttpStatus.BAD_GATEWAY,
    message: "Falha ao acessar o armazenamento de arquivos. Tente novamente.",
  },
} as const;
