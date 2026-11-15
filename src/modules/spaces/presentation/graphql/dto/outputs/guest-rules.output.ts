import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("GuestRules", { description: "Regras de convidados do espaço." })
export class GuestRulesType {
  @Field({ description: "Quem reserva pode levar convidados." })
  allowed!: boolean;

  @Field(() => Int, {
    nullable: true,
    description: "Máximo de convidados por reserva (null: sem limite).",
  })
  max!: number | null;

  @Field({ description: "A portaria exige o documento de cada convidado." })
  documentRequired!: boolean;
}
