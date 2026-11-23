import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("PurchaseRequestOverview", {
  description:
    "As solicitações em números (os cards da página), independente dos filtros.",
})
export class PurchaseRequestOverviewType {
  @Field(() => Int, { description: "Aguardando cotação." })
  open!: number;

  @Field(() => Int, {
    description: "Pendentes (em cotação ou aguardando aprovação) e urgentes.",
  })
  urgent!: number;

  @Field(() => Int, {
    description: "Pendentes e precisam em até 7 dias.",
  })
  dueSoon!: number;

  @Field(() => Int, {
    description: "Pendentes e com a data em que precisavam já passada.",
  })
  overdue!: number;
}
