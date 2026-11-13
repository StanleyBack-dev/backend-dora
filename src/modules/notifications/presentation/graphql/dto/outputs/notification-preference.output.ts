import { Field, ObjectType } from "@nestjs/graphql";
import { NotificationType } from "@/modules/notifications/domain/notification";
import "@/modules/notifications/presentation/graphql/notifications.graphql-enums";

@ObjectType("NotificationPreference")
export class NotificationPreferenceType {
  @Field(() => NotificationType)
  type!: NotificationType;

  @Field({ description: "Também recebe por e-mail." })
  emailEnabled!: boolean;
}
