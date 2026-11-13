import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import {
  SupportCategory,
  SupportStatus,
} from "@/modules/support/domain/support-request";
import "@/modules/support/presentation/graphql/support.graphql-enums";

@ObjectType("SupportRequest", { description: "Solicitação de suporte." })
export class SupportRequestType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int, { description: "Número do protocolo (#000042)." })
  protocol!: number;

  @Field(() => ID)
  userId!: string;

  @Field()
  userName!: string;

  @Field(() => String, {
    nullable: true,
    description: "Condomínio em que a pessoa estava ao pedir ajuda.",
  })
  condominiumName!: string | null;

  @Field(() => SupportCategory)
  category!: SupportCategory;

  @Field()
  subject!: string;

  @Field()
  message!: string;

  @Field(() => SupportStatus)
  status!: SupportStatus;

  @Field(() => String, { nullable: true })
  reply!: string | null;

  @Field(() => Date, { nullable: true })
  repliedAt!: Date | null;

  @Field(() => String, { nullable: true })
  repliedByName!: string | null;

  @Field(() => Date, { nullable: true })
  finalizedAt!: Date | null;

  @Field(() => String, { nullable: true })
  finalizedByName!: string | null;

  @Field()
  createdAt!: Date;
}
