import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("BookingsPoint", {
  description: "Reservas de um intervalo da série.",
})
export class BookingsPointType {
  @Field(() => String, {
    description: "Primeiro dia do intervalo (YYYY-MM-DD).",
  })
  bucket!: string;

  @Field(() => Int, { description: "Reservas com horário no intervalo." })
  total!: number;

  @Field(() => Int, { description: "Delas, canceladas." })
  cancelled!: number;
}
