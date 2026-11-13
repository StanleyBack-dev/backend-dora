import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Permission } from "@/modules/access-control/domain/permission";

@Entity("tb_membership_permission_overrides")
@Index(["membershipId", "permission"], { unique: true })
export class PermissionOverrideOrmEntity {
  @PrimaryGeneratedColumn("uuid", {
    name: "idtb_membership_permission_overrides",
  })
  id!: string;

  // FK to tb_memberships (ON DELETE CASCADE) lives in the migration: this
  // module does not map the identity module's entity.
  @Column({ name: "idtb_memberships", type: "uuid" })
  membershipId!: string;

  @Column({ type: "varchar", length: 64 })
  permission!: Permission;

  @Column({ type: "boolean" })
  allowed!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
