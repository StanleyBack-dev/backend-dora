import { Field, ID, InputType } from "@nestjs/graphql";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
} from "class-validator";
import { Permission } from "@/modules/access-control/domain/permission";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";

@InputType()
export class SetUserPermissionsInput {
  @Field(() => ID)
  @IsUUID()
  userId!: string;

  @Field({
    description: "true descarta as exceções e volta ao padrão do grupo.",
  })
  @IsBoolean()
  useGroupDefaults!: boolean;

  @Field(() => [Permission], {
    nullable: true,
    description: "Conjunto completo desejado (ignorado com useGroupDefaults).",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}
