import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { FoundItemStatus } from "@/modules/lost-and-found/domain/found-item";
import "@/modules/lost-and-found/presentation/graphql/lost-found.graphql-enums";

@ObjectType("FoundItemStatusCount")
export class FoundItemStatusCountType {
  @Field(() => FoundItemStatus)
  status!: FoundItemStatus;

  @Field(() => Int)
  count!: number;
}

@ObjectType("FoundItemResident", {
  description: "Um morador que pediu um item ou para quem um foi reservado.",
})
export class FoundItemResidentType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
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

  @Field(() => [String], {
    description: "Os itens registrados (para o filtro; recentes primeiro).",
  })
  titles!: string[];

  @Field(() => [String], { description: "Os locais onde itens foram achados." })
  foundLocations!: string[];

  @Field(() => [String], { description: "Os locais de guarda usados." })
  storageLocations!: string[];

  @Field(() => [FoundItemResidentType], {
    description:
      "Moradores que pediram itens ou para quem itens foram reservados.",
  })
  residents!: FoundItemResidentType[];
}
