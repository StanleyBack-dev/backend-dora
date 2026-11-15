import { Field, ID, InputType } from "@nestjs/graphql";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

// By the code on the invite (typed or scanned) or from the day's list.
@InputType()
export class CheckInGuestInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  guestId?: string | null;

  @Field(() => String, { nullable: true, description: "Código do convite." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string | null;
}
