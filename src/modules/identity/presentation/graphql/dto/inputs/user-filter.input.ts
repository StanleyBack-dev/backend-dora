import { Field, ID, InputType } from "@nestjs/graphql";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";

@InputType()
export class UserFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Field(() => UserGroup, { nullable: true })
  @IsOptional()
  @IsEnum(UserGroup)
  group?: UserGroup;

  @Field(() => [UserGroup], {
    nullable: true,
    description:
      "Qualquer um destes papéis (ex.: a equipe, ADMIN e CONCIERGE).",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(UserGroup, { each: true })
  groups?: UserGroup[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}
