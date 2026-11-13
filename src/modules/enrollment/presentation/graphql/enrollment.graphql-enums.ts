import { registerEnumType } from "@nestjs/graphql";
import { EnrollmentStatus } from "@/modules/enrollment/domain/enrollment";

registerEnumType(EnrollmentStatus, {
  name: "EnrollmentStatus",
  description: "Situação do cadastro enviado pelo link público.",
});
