import { Field, InputType, Int } from "@nestjs/graphql";
import { IsInt, IsString, Length, Max, Min } from "class-validator";

@InputType()
export class CreateEnrollmentInviteInput {
  @Field()
  @IsString()
  @Length(2, 80)
  label!: string;

  @Field(() => Int, { description: "Validade em dias (1 a 30)." })
  @IsInt()
  @Min(1)
  @Max(30)
  validDays!: number;
}
