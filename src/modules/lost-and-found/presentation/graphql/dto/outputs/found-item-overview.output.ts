import { Field, Int, ObjectType } from "@nestjs/graphql";
import { FoundItemStatus } from "@/modules/lost-and-found/domain/found-item";
import "@/modules/lost-and-found/presentation/graphql/lost-found.graphql-enums";

@ObjectType("FoundItemStatusCount")
export class FoundItemStatusCountType {
  @Field(() => FoundItemStatus)
  status!: FoundItemStatus;

  @Field(() => Int)
  count!: number;
}

@ObjectType("FoundItemOverview", {
  description: "Os itens achados do condomínio em números.",
})
export class FoundItemOverviewType {
  @Field(() => [FoundItemStatusCountType])
  byStatus!: FoundItemStatusCountType[];

  @Field(() => Int, { description: "Pedidos aguardando a portaria." })
  pendingClaims!: number;

  @Field(() => Int, {
    description: "Itens guardados com o prazo terminando em até 7 dias.",
  })
  expiringSoon!: number;
}
