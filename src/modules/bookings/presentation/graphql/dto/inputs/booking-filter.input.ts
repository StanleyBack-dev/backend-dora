import { Field, ID, InputType } from "@nestjs/graphql";
import { IsDate, IsEnum, IsOptional, IsUUID } from "class-validator";
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

  /** Starts on or after this instant (the calendar's first day). */
  @Field({
    nullable: true,
    description: "Começa a partir deste instante (início do calendário).",
  })
  @IsOptional()
  @IsDate()
  from?: Date;

  /** Starts before this instant (the day after the calendar's last). */
  @Field({
    nullable: true,
    description: "Começa antes deste instante (fim do calendário, exclusivo).",
  })
  @IsOptional()
  @IsDate()
  to?: Date;
}
