import { Field, InputType } from "@nestjs/graphql";
import { IsString, Length } from "class-validator";

@InputType()
export class VerifyRecoveryCodeInput {
  @Field()
  @IsString()
  @Length(1, 254)
  login!: string;

  @Field()
  @IsString()
  @Length(4, 12)
  code!: string;
}
