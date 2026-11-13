import { registerEnumType } from "@nestjs/graphql";
import { NotificationType } from "@/modules/notifications/domain/notification";

registerEnumType(NotificationType, { name: "NotificationType" });
