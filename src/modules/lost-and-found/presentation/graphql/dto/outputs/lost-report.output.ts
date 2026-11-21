import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { FoundItemCategory } from "@/modules/lost-and-found/domain/found-item";
import { LostReportStatus } from "@/modules/lost-and-found/domain/lost-report";
import "@/modules/lost-and-found/presentation/graphql/lost-found.graphql-enums";

@ObjectType("LostReport", {
  description: '"Perdi algo": o que um morador perdeu.',
})
export class LostReportType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  userId!: string;

  @Field()
  userName!: string;

  @Field(() => ID, {
    nullable: true,
    description: "A unidade de quem perdeu (para indicar o dono de um item).",
  })
  unitId!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "A unidade de quem perdeu.",
  })
  unitLabel!: string | null;

  @Field(() => FoundItemCategory)
  category!: FoundItemCategory;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String, { nullable: true })
  lostLocation!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "O dia em que perdeu (AAAA-MM-DD).",
  })
  lostOn!: string | null;

  /** Internal: the stored photo (resolved as photoUrl). */
  photoKey!: string | null;

  @Field({ description: "Aparece no mural dos vizinhos." })
  shared!: boolean;

  @Field(() => Int, { description: 'Vizinhos que disseram "Achei isso".' })
  spotCount!: number;

  @Field(() => LostReportStatus)
  status!: LostReportStatus;

  @Field(() => ID, {
    nullable: true,
    description: "O item achado com que o aviso terminou.",
  })
  foundItemId!: string | null;

  @Field(() => Date, { nullable: true })
  closedAt!: Date | null;

  @Field()
  createdAt!: Date;
}
