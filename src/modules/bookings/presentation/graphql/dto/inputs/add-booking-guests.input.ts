import { Field, ID, InputType } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { MAX_GUESTS_PER_REQUEST } from "@/modules/bookings/domain/booking-guest";
import { GuestInput } from "@/modules/bookings/presentation/graphql/dto/inputs/guest.input";

@InputType()
export class AddBookingGuestsInput {
  @Field(() => ID)
  @IsUUID()
  bookingId!: string;

  @Field(() => [GuestInput])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GUESTS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => GuestInput)
  guests!: GuestInput[];
}
