import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

// A resident's record (one per resident membership). The FKs to
// tb_memberships (with its kind) and tb_units live in the migration.
@Entity("tb_residents")
export class ResidentOrmEntity {
  @PrimaryColumn("uuid", { name: "idtb_memberships" })
  membershipId!: string;

  @Column({ name: "idtb_units", type: "uuid", nullable: true })
  unitId!: string | null;

  @Column({
    name: "unit_complement",
    type: "varchar",
    length: 80,
    nullable: true,
  })
  unitComplement!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
