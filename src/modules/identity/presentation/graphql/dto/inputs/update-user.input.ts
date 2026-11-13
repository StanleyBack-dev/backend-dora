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
export class UpdateUserInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(3, 32)
  username?: string;

  @Field(() => UserGroup, { nullable: true })
  @IsOptional()
  @IsEnum(UserGroup)
  group?: UserGroup;

  @Field(() => ID, {
    nullable: true,
    description: "Ausente: não muda. null: sem unidade.",
  })
  @IsOptional()
  @IsUUID()
  unitId?: string | null;
}
