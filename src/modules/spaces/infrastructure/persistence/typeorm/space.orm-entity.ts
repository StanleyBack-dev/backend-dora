import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { SpaceKind } from "@/modules/spaces/domain/space";
import type {
  LimitPeriod,
  OpeningHours,
} from "@/modules/spaces/domain/space-rules";

@Entity("tb_spaces")
export class SpaceOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_spaces" })
  id!: string;

  // FK to tb_condominiums lives in the migration (another module's table).
  @Column({ name: "idtb_condominiums", type: "uuid" })
  condominiumId!: string;

  @Column({ type: "varchar", length: 80 })
  name!: string;

  @Column({ type: "varchar", length: 16 })
  kind!: SpaceKind;

  @Column({ type: "varchar", length: 1000, nullable: true })
  description!: string | null;

  @Column({ type: "int", nullable: true })
  capacity!: number | null;

  @Column({
    name: "usage_rules",
    type: "varchar",
    length: 3000,
    nullable: true,
  })
  usageRules!: string | null;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ name: "opening_hours", type: "jsonb" })
  openingHours!: OpeningHours[];

  @Column({ name: "slot_minutes", type: "int" })
  slotMinutes!: number;

  @Column({ name: "min_advance_hours", type: "int" })
  minAdvanceHours!: number;

  @Column({ name: "max_advance_days", type: "int" })
  maxAdvanceDays!: number;

  @Column({ name: "unit_limit_count", type: "int", nullable: true })
  unitLimitCount!: number | null;

  @Column({
    name: "unit_limit_period",
    type: "varchar",
    length: 5,
    nullable: true,
  })
  unitLimitPeriod!: LimitPeriod | null;

  @Column({ name: "requires_approval", type: "boolean" })
  requiresApproval!: boolean;

  @Column({ name: "cancel_until_hours", type: "int" })
  cancelUntilHours!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
