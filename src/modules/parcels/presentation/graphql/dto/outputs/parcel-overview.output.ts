import { Field, Int, ObjectType } from "@nestjs/graphql";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";
import { UnitOptionType } from "@/modules/events/presentation/graphql/dto/outputs/unit-option.output";
import "@/modules/parcels/presentation/graphql/parcels.graphql-enums";

@ObjectType("ParcelStatusCount")
export class ParcelStatusCountType {
  @Field(() => ParcelStatus)
  status!: ParcelStatus;

  @Field(() => Int)
  count!: number;
}

@ObjectType("ParcelOverview", {
  description:
    "As encomendas do condomínio em números e as unidades do filtro.",
})
export class ParcelOverviewType {
  @Field(() => [ParcelStatusCountType])
  byStatus!: ParcelStatusCountType[];

  @Field(() => Int, {
    description: "Aguardando retirada há mais dias que o lembrete (3 dias).",
  })
  waitingLong!: number;

  @Field(() => [UnitOptionType])
  units!: UnitOptionType[];
}
