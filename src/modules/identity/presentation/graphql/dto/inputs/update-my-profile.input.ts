import { Field, InputType } from "@nestjs/graphql";
import { IsEmail, IsString, Length, MaxLength } from "class-validator";

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
}
