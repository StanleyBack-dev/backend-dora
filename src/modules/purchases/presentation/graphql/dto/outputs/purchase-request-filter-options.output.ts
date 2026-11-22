import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("PurchaseRequestOption", {
  description: "Uma solicitação no filtro (número e título).",
})
export class PurchaseRequestOptionType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  number!: number;

  @Field()
  title!: string;
}

@ObjectType("PurchaseRequesterOption", {
  description: "Quem fez solicitações (filtro “Solicitante”).",
})
export class PurchaseRequesterOptionType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType("PurchaseRequestFilterOptions", {
  description:
    "O que os filtros das solicitações oferecem (as que a pessoa vê).",
})
export class PurchaseRequestFilterOptionsType {
  @Field(() => [PurchaseRequestOptionType])
  requests!: PurchaseRequestOptionType[];

  @Field(() => [PurchaseRequesterOptionType])
  requesters!: PurchaseRequesterOptionType[];
}
