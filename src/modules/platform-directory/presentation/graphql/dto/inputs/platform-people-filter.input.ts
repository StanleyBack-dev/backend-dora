import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";

@InputType()
export class PlatformPeopleFilterInput {
  @Field(() => String, {
    nullable: true,
    description: "Nome, e-mail ou usuário (a partir de 2 letras).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string | null;

  @Field(() => UserGroup, {
    nullable: true,
    description:
      "ADMIN_MASTER: a plataforma; os outros: o papel em algum condomínio.",
  })
  @IsOptional()
  @IsEnum(UserGroup)
  role?: UserGroup | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  condominiumId?: string | null;
}
