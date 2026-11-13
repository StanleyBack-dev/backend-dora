import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("tb_enrollment_invites")
export class EnrollmentInviteOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_enrollment_invites" })
  id!: string;

  @Column({ name: "idtb_condominiums", type: "uuid" })
  condominiumId!: string;

  @Column({ type: "varchar", length: 6 })
  code!: string;

  @Column({ type: "varchar", length: 80 })
  label!: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt!: Date | null;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
