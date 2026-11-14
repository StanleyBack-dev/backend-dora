import { Field, InputType } from "@nestjs/graphql";
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";

@InputType()
export class UpdateMyProfileInput {
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
    description: "Telefone de contato (ausente: mantém; vazio: remove).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;
}
