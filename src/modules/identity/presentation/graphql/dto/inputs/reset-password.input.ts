import { Field, InputType } from "@nestjs/graphql";
import { IsString, Length } from "class-validator";

@InputType()
export class ResetPasswordInput {
  @Field()
  @IsString()
  @Length(16, 256)
  resetToken!: string;

  @Field()
  @IsString()
  @Length(1, 128)
  newPassword!: string;
}
