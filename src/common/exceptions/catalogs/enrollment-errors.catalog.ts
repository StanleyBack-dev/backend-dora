import { HttpStatus } from "@nestjs/common";

export const enrollmentErrors = {
  invalidCode: {
    code: "ENROLLMENT_INVALID_CODE",
    // Not 401: the BFF would read it as an expired session.
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Código inválido ou expirado. Peça um novo código à administração.",
  },
  formExpired: {
    code: "ENROLLMENT_FORM_EXPIRED",
    status: HttpStatus.GONE,
    message:
      "O tempo para preencher o formulário acabou. Digite o código de novo.",
  },
  invalidName: {
    code: "ENROLLMENT_INVALID_NAME",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe o nome completo (nome e sobrenome).",
  },
  invalidEmail: {
    code: "ENROLLMENT_INVALID_EMAIL",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe um e-mail válido.",
  },
  invalidPhone: {
    code: "ENROLLMENT_INVALID_PHONE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Telefone inválido. Use DDD + número (10 ou 11 dígitos).",
  },
  consentRequired: {
    code: "ENROLLMENT_CONSENT_REQUIRED",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "É preciso aceitar o uso dos dados para enviar o cadastro.",
  },
  invalidPhoto: {
    code: "ENROLLMENT_INVALID_PHOTO",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "A foto deve ser uma imagem JPEG, PNG ou WebP de até 2 MB.",
  },
  alreadyPending: {
    code: "ENROLLMENT_ALREADY_PENDING",
    status: HttpStatus.CONFLICT,
    message: "Já existe um cadastro aguardando aprovação com este e-mail.",
  },
  alreadyUser: {
    code: "ENROLLMENT_ALREADY_USER",
    status: HttpStatus.CONFLICT,
    message:
      "Este e-mail já faz parte deste condomínio. Entre com a sua conta ou fale com a administração.",
  },
  notFound: {
    code: "ENROLLMENT_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Solicitação não encontrada.",
  },
  notPending: {
    code: "ENROLLMENT_NOT_PENDING",
    status: HttpStatus.CONFLICT,
    message: "Esta solicitação já foi analisada.",
  },
  inviteNotFound: {
    code: "ENROLLMENT_INVITE_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Código de convite não encontrado.",
  },
  invalidInvite: {
    code: "ENROLLMENT_INVALID_INVITE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Dê um nome ao convite e uma validade de 1 a 30 dias.",
  },
  invalidReason: {
    code: "ENROLLMENT_INVALID_REASON",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe o motivo da recusa (de 3 a 500 caracteres).",
  },
  invalidUnit: {
    code: "ENROLLMENT_INVALID_UNIT",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Escolha a sua unidade na lista.",
  },
} as const;
