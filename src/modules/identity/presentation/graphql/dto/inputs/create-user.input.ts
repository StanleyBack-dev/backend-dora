import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";

@InputType()
export class CreateUserInput {
  @Field()
  @IsString()
  @Length(2, 120)
  name!: string;

  @Field()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Field(() => String, {
    nullable: true,
    description:
      "Login: 3 a 32 caracteres (a-z, 0-9, ., -, _). Vazio: gerado do nome.",
  })
  @IsOptional()
  @IsString()
  @Length(3, 32)
  username?: string | null;

  @Field(() => UserGroup, { description: "USER (morador) ou ADMIN (gestor)." })
  @IsEnum(UserGroup)
  group!: UserGroup;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  unitId?: string | null;
}
