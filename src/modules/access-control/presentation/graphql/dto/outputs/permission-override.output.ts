import { Field, ObjectType } from "@nestjs/graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";

@ObjectType("PermissionOverride")
export class PermissionOverrideType {
  @Field(() => Permission)
  permission!: Permission;

  @Field()
  allowed!: boolean;
}
