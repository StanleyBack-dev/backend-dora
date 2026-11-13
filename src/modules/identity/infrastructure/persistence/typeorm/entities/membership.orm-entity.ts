import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { UserGroup } from "@/modules/access-control/domain/user-group";

@Entity("tb_memberships")
export class MembershipOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_memberships" })
  id!: string;

  @Column({ name: "idtb_users", type: "uuid" })
  userId!: string;

  // FKs to tb_condominiums and tb_units live in the migration: identity
  // does not map the condominiums module's entities.
  @Column({ name: "idtb_condominiums", type: "uuid" })
  condominiumId!: string;

  @Column({ type: "varchar", length: 10 })
  role!: UserGroup;

  @Column({ name: "idtb_units", type: "uuid", nullable: true })
  unitId!: string | null;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ name: "last_selected_at", type: "timestamptz", nullable: true })
  lastSelectedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
