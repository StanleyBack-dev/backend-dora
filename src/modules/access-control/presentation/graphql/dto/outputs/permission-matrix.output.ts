import { Field, ObjectType } from "@nestjs/graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { PermissionOverrideType } from "@/modules/access-control/presentation/graphql/dto/outputs/permission-override.output";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";

@ObjectType("PermissionMatrix")
export class PermissionMatrixType {
  @Field(() => [Permission], {
    description: "O que o usuário pode fazer (padrão do grupo + exceções).",
  })
  effective!: Permission[];

  @Field(() => [Permission], { description: "O que o grupo concede." })
  defaults!: Permission[];

  @Field(() => [PermissionOverrideType], {
    description: "Exceções do usuário em relação ao grupo.",
  })
  overrides!: PermissionOverrideType[];
}
