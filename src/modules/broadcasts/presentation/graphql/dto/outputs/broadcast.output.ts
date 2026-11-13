import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { BroadcastAudience } from "@/modules/broadcasts/domain/broadcast";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";
import "@/modules/broadcasts/presentation/graphql/broadcasts.graphql-enums";

@ObjectType("Broadcast", {
  description: "Comunicado enviado por um gestor aos membros do condomínio.",
})
export class BroadcastType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field(() => BroadcastAudience)
  audience!: BroadcastAudience;

  @Field(() => UserGroup, { nullable: true })
  targetGroup!: UserGroup | null;

  @Field()
  sendEmail!: boolean;

  @Field(() => Int, { description: "Quantas pessoas receberam." })
  recipients!: number;

  @Field(() => String, { nullable: true })
  authorName!: string | null;

  @Field()
  createdAt!: Date;
}
