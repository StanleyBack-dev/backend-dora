import { Field, Int, ObjectType } from "@nestjs/graphql";
import { BookingType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking.output";

@ObjectType("BookingFees", {
  description: "Taxas de uso do mês, para a cobrança do condomínio.",
})
export class BookingFeesType {
  @Field(() => String, { description: "YYYY-MM." })
  month!: string;

  @Field(() => [BookingType], {
    description: "Reservas confirmadas com taxa, por unidade.",
  })
  items!: BookingType[];

  @Field(() => Int)
  totalCents!: number;

  @Field(() => Int, { description: "Já lançado na cobrança." })
  billedCents!: number;
}
