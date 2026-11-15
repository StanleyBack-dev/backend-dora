import { Field, ID, ObjectType } from "@nestjs/graphql";
import { BookingType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking.output";
import { SkippedDateType } from "@/modules/bookings/presentation/graphql/dto/outputs/skipped-date.output";

@ObjectType("BookingSeriesResult", {
  description: "Resultado de uma reserva recorrente.",
})
export class BookingSeriesResultType {
  @Field(() => ID)
  seriesId!: string;

  @Field(() => [BookingType], {
    description: "Reservas criadas, uma por semana.",
  })
  created!: BookingType[];

  @Field(() => [SkippedDateType], { description: "Datas puladas e o motivo." })
  skipped!: SkippedDateType[];
}
