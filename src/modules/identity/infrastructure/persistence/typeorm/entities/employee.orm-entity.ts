import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

// An employee's record (one per employee membership): the base for a
// future time sheet. The FK to tb_memberships (with its kind) lives in the
// migration.
@Entity("tb_employees")
export class EmployeeOrmEntity {
  @PrimaryColumn("uuid", { name: "idtb_memberships" })
  membershipId!: string;

  @Column({ name: "job_title", type: "varchar", length: 60, nullable: true })
  jobTitle!: string | null;

  /** YYYY-MM-DD (a date column comes back as a string). */
  @Column({ name: "hired_on", type: "date", nullable: true })
  hiredOn!: string | null;

  @Column({ name: "work_shift", type: "varchar", length: 80, nullable: true })
  workShift!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  contractor!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
