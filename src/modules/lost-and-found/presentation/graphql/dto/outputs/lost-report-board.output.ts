import { Field, ID, ObjectType } from "@nestjs/graphql";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { FoundItemCategory } from "@/modules/lost-and-found/domain/found-item";
import "@/modules/lost-and-found/presentation/graphql/lost-found.graphql-enums";

@ObjectType("LostReportBoardItem", {
  description:
    'Um aviso de "Perdi algo" no mural dos vizinhos: sem quem perdeu nem os detalhes.',
})
export class LostReportBoardItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => FoundItemCategory)
  category!: FoundItemCategory;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  lostLocation!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "O dia em que perdeu (AAAA-MM-DD).",
  })
  lostOn!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Link temporário da foto (nulo: sem foto).",
  })
  photoUrl!: string | null;

  @Field({ description: "O aviso é de quem está vendo." })
  mine!: boolean;

  @Field({ description: "Quem está vendo já disse que achou." })
  spottedByMe!: boolean;

  @Field()
  createdAt!: Date;
}

export const LostReportBoardPage = Paginated(
  LostReportBoardItemType,
  "LostReportBoardPage",
);
