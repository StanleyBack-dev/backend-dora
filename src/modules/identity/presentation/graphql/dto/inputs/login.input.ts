import { Field, InputType } from "@nestjs/graphql";
import { IsString, Length } from "class-validator";

@InputType()
export class LoginInput {
  @Field({ description: "Usuário ou e-mail." })
  @IsString()
  @Length(1, 254)
  login!: string;

  @Field()
  @IsString()
  @Length(1, 128)
  password!: string;
}
