import { Field, ID, InputType } from "@nestjs/graphql";
import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { BookingStatus, BookingWhen } from "@/modules/bookings/domain/booking";
import "@/modules/bookings/presentation/graphql/bookings.graphql-enums";

@InputType()
export class BookingFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @Field(() => BookingStatus, { nullable: true })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @Field(() => BookingWhen, { nullable: true })
  @IsOptional()
  @IsEnum(BookingWhen)
  when?: BookingWhen;
}
