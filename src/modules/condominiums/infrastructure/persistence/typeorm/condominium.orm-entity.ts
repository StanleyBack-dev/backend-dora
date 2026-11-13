import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { CondominiumStatus } from "@/modules/condominiums/domain/condominium";

@Entity("tb_condominiums")
export class CondominiumOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_condominiums" })
  id!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "varchar", length: 14, nullable: true })
  document!: string | null;

  @Column({ type: "varchar", length: 80 })
  city!: string;

  @Column({ type: "char", length: 2 })
  state!: string;

  @Column({ type: "varchar", length: 10, default: "ACTIVE" })
  status!: CondominiumStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
