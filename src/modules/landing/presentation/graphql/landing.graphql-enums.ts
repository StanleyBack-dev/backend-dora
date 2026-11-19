import { registerEnumType } from "@nestjs/graphql";
import {
  LandingDevice,
  LandingEventType,
} from "@/modules/landing/domain/landing-event";
import {
  LeadMailStatus,
  LeadRole,
  LeadSubject,
  LeadUnitsRange,
} from "@/modules/landing/domain/landing-lead";

registerEnumType(LeadRole, {
  name: "LandingLeadRole",
  description: "Quem escreveu pelo site (síndico, administradora…).",
});
registerEnumType(LeadSubject, {
  name: "LandingLeadSubject",
  description: "Assunto da mensagem enviada pelo site.",
});
registerEnumType(LeadUnitsRange, {
  name: "LandingLeadUnitsRange",
  description: "Tamanho do condomínio, em unidades.",
});
registerEnumType(LeadMailStatus, {
  name: "LandingLeadMailStatus",
  description: "Se o e-mail chegou à caixa do Dora.",
});
registerEnumType(LandingEventType, {
  name: "LandingEventType",
  description: "O que aconteceu na landing page.",
});
registerEnumType(LandingDevice, {
  name: "LandingDevice",
  description: "Tipo de tela do visitante.",
});
