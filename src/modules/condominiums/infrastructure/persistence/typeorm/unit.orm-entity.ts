import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("tb_units")
export class UnitOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_units" })
  id!: string;

  @Column({ name: "idtb_condominiums", type: "uuid" })
  condominiumId!: string;

  @Column({ type: "varchar", length: 30 })
  block!: string;

  @Column({ type: "varchar", length: 20 })
  number!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
