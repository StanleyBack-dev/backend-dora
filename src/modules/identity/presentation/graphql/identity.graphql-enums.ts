import { registerEnumType } from "@nestjs/graphql";
import { MemberKind } from "@/modules/identity/domain/member-profile";

registerEnumType(MemberKind, {
  name: "MemberKind",
  description: "Vínculo com o condomínio: morador ou funcionário.",
});
