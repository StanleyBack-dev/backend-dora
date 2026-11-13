import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BroadcastAudience } from "@/modules/broadcasts/domain/broadcast";
import type { UserGroup } from "@/modules/access-control/domain/user-group";

@Entity("tb_broadcasts")
export class BroadcastOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_broadcasts" })
  id!: string;

  @Column({ type: "varchar", length: 120 })
  title!: string;

  @Column({ type: "varchar", length: 2000 })
  body!: string;

  @Column({ type: "varchar", length: 16 })
  audience!: BroadcastAudience;

  @Column({
    name: "target_group",
    type: "varchar",
    length: 16,
    nullable: true,
  })
  targetGroup!: UserGroup | null;

  @Column({ name: "send_email", type: "boolean" })
  sendEmail!: boolean;

  @Column({ type: "int" })
  recipients!: number;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
