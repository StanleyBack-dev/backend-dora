import { Field, ID, ObjectType } from "@nestjs/graphql";
import { NotificationType } from "@/modules/notifications/domain/notification";
import "@/modules/notifications/presentation/graphql/notifications.graphql-enums";

@ObjectType("Notification")
export class NotificationGqlType {
  @Field(() => ID)
  id!: string;

  @Field(() => NotificationType)
  type!: NotificationType;

  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field(() => String, { nullable: true, description: "Caminho no app." })
  link!: string | null;

  @Field(() => Date, { nullable: true })
  readAt!: Date | null;

  @Field()
  createdAt!: Date;
}
