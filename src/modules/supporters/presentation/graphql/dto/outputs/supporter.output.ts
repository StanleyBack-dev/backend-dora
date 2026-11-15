import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { SupportContributionType } from "@/modules/supporters/presentation/graphql/dto/outputs/support-contribution.output";

@ObjectType("Supporter", {
  description: "Quem apoia o Dora, com o total e cada apoio (administração).",
})
export class SupporterType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ description: 'Falso: aparece como "Apoiador anônimo".' })
  showName!: boolean;

  @Field(() => Int)
  totalCents!: number;

  @Field(() => Int)
  contributions!: number;

  @Field(() => String, { nullable: true, description: "YYYY-MM-DD." })
  lastReceivedOn!: string | null;

  @Field(() => [SupportContributionType], {
    description: "Do mais recente ao mais antigo.",
  })
  history!: SupportContributionType[];
}
