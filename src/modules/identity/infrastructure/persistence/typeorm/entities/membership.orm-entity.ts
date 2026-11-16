import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { UserGroup } from "@/modules/access-control/domain/user-group";
import type { MemberKind } from "@/modules/identity/domain/member-profile";

@Entity("tb_memberships")
export class MembershipOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_memberships" })
  id!: string;

  @Column({ name: "idtb_users", type: "uuid" })
  userId!: string;

  // The FK to tb_condominiums lives in the migration: identity
  // does not map the condominiums module's entities.
  @Column({ name: "idtb_condominiums", type: "uuid" })
  condominiumId!: string;

  @Column({ type: "varchar", length: 10 })
  role!: UserGroup;

  /** Resident or employee: its record is in tb_residents / tb_employees. */
  @Column({ type: "varchar", length: 10 })
  kind!: MemberKind;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ name: "last_selected_at", type: "timestamptz", nullable: true })
  lastSelectedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
