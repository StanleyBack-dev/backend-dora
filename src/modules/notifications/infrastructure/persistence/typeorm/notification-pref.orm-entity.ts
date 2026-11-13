import { Column, Entity, PrimaryColumn } from "typeorm";
import { NotificationType } from "@/modules/notifications/domain/notification";

@Entity("tb_notification_prefs")
export class NotificationPrefOrmEntity {
  @PrimaryColumn({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @PrimaryColumn({ type: "varchar", length: 32 })
  type!: NotificationType;

  @Column({ name: "email_enabled", type: "boolean" })
  emailEnabled!: boolean;
}
