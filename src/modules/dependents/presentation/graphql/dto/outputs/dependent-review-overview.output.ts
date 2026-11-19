import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { DependentType } from "@/modules/dependents/presentation/graphql/dto/outputs/dependent.output";

@ObjectType("DependentFilterOption", {
  description: "Algo para escolher num filtro dos dependentes.",
})
export class DependentFilterOptionType {
  @Field(() => ID)
  id!: string;

  @Field()
  label!: string;
}

@ObjectType("DependentReviewOverview", {
  description:
    "Os dependentes em números (por situação) e o que os filtros oferecem.",
})
export class DependentReviewOverviewType {
  @Field(() => Int)
  pending!: number;

  @Field(() => Int)
  approved!: number;

  @Field(() => Int)
  rejected!: number;

  @Field(() => [DependentFilterOptionType])
  dependents!: DependentFilterOptionType[];

  @Field(() => [DependentFilterOptionType], {
    description: "Moradores que cadastraram dependentes.",
  })
  holders!: DependentFilterOptionType[];

  @Field(() => [DependentFilterOptionType])
  units!: DependentFilterOptionType[];
}

export const DependentPage = Paginated(DependentType, "DependentPage");
