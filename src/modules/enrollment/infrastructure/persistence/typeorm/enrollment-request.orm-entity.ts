import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import type {
  EnrollmentApplicant,
  EnrollmentStatus,
} from "@/modules/enrollment/domain/enrollment";

@Entity("tb_enrollment_requests")
export class EnrollmentRequestOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_enrollment_requests" })
  id!: string;

  @Column({ name: "idtb_condominiums", type: "uuid" })
  condominiumId!: string;

  @Column({ name: "idtb_units", type: "uuid", nullable: true })
  unitId!: string | null;

  @Column({
    name: "unit_complement",
    type: "varchar",
    length: 80,
    nullable: true,
  })
  unitComplement!: string | null;

  @Column({
    name: "typed_unit_street",
    type: "varchar",
    length: 80,
    nullable: true,
  })
  typedUnitStreet!: string | null;

  @Column({
    name: "typed_unit_block",
    type: "varchar",
    length: 30,
    nullable: true,
  })
  typedUnitBlock!: string | null;

  @Column({
    name: "typed_unit_number",
    type: "varchar",
    length: 20,
    nullable: true,
  })
  typedUnitNumber!: string | null;

  @Column({ name: "idtb_enrollment_invites", type: "uuid", nullable: true })
  inviteId!: string | null;

  @Column({ type: "varchar", length: 10 })
  status!: EnrollmentStatus;

  @Column({ type: "varchar", length: 10, default: "RESIDENT" })
  applicant!: EnrollmentApplicant;

  @Column({ name: "full_name", type: "varchar", length: 160 })
  fullName!: string;

  @Column({ type: "varchar", length: 254 })
  email!: string;

  @Column({ type: "varchar", length: 11 })
  phone!: string;

  @Column({ name: "consent_at", type: "timestamptz" })
  consentAt!: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "reviewed_by", type: "uuid", nullable: true })
  reviewedBy!: string | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt!: Date | null;

  @Column({
    name: "rejection_reason",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  rejectionReason!: string | null;

  @Column({ name: "idtb_users", type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ name: "photo_key", type: "varchar", length: 200, nullable: true })
  photoKey!: string | null;
}
