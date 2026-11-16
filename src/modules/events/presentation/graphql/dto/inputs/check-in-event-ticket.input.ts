import { Field, ID, InputType } from "@nestjs/graphql";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

// By the ticket's code (typed or read from the QR) or from the day's list.
@InputType()
export class CheckInEventTicketInput {
  @Field(() => ID, { nullable: true, description: "A pessoa do pedido." })
  @IsOptional()
  @IsUUID()
  attendeeId?: string | null;

  @Field(() => String, { nullable: true, description: "Código do ingresso." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string | null;
}
