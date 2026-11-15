import { Field, ID, InputType } from "@nestjs/graphql";
import { ArrayMaxSize, IsArray, IsBoolean, IsUUID } from "class-validator";
import { MAX_FEES_PER_REQUEST } from "@/modules/bookings/application/use-cases/set-booking-fees-billed.use-case";

@InputType()
export class SetBookingFeesBilledInput {
  @Field(() => [ID])
  @IsArray()
  @ArrayMaxSize(MAX_FEES_PER_REQUEST)
  @IsUUID("all", { each: true })
  bookingIds!: string[];

  @Field({ description: "true: lançadas na cobrança; false: desfaz." })
  @IsBoolean()
  billed!: boolean;
}
