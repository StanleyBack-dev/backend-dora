import { registerEnumType } from "@nestjs/graphql";
import {
  EnrollmentApplicant,
  EnrollmentStatus,
} from "@/modules/enrollment/domain/enrollment";

registerEnumType(EnrollmentStatus, {
  name: "EnrollmentStatus",
  description: "Situação do cadastro enviado pelo link público.",
});

registerEnumType(EnrollmentApplicant, {
  name: "EnrollmentApplicant",
  description: "Quem se cadastra: morador ou funcionário do condomínio.",
});
