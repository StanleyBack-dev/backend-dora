import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("OpeningHours", {
  description: "Horário de um dia da semana (dia ausente: fechado).",
})
export class OpeningHoursType {
  @Field(() => Int, { description: "0 = domingo … 6 = sábado." })
  weekday!: number;

  @Field({ description: '"HH:MM".' })
  opensAt!: string;

  @Field({ description: '"HH:MM" ("24:00" = até meia-noite).' })
  closesAt!: string;
}
