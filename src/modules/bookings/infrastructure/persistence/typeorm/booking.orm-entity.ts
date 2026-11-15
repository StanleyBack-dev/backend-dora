import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type { BookingStatus } from "@/modules/bookings/domain/booking";

// FKs to other modules' tables (condominiums, spaces, users, units) and the
// no-overlap exclusion constraint live in the migration.
@Entity("tb_bookings")
export class BookingOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_bookings" })
  id!: string;

  @Column({ name: "idtb_condominiums", type: "uuid" })
  condominiumId!: string;

  @Column({ name: "idtb_spaces", type: "uuid" })
  spaceId!: string;

  @Column({ name: "idtb_users", type: "uuid" })
  userId!: string;

  @Column({ name: "idtb_units", type: "uuid", nullable: true })
  unitId!: string | null;

  @Column({ name: "starts_at", type: "timestamptz" })
  startsAt!: Date;

  @Column({ name: "ends_at", type: "timestamptz" })
  endsAt!: Date;

  @Column({ type: "varchar", length: 10 })
  status!: BookingStatus;

  @Column({ type: "varchar", length: 300, nullable: true })
  notes!: string | null;

  @Column({ name: "cancel_until", type: "timestamptz" })
  cancelUntil!: Date;

  @Column({ name: "decided_by", type: "uuid", nullable: true })
  decidedBy!: string | null;

  @Column({ name: "decided_at", type: "timestamptz", nullable: true })
  decidedAt!: Date | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  reason!: string | null;

  @Column({ name: "cancelled_by", type: "uuid", nullable: true })
  cancelledBy!: string | null;

  @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: "fee_cents", type: "int", nullable: true })
  feeCents!: number | null;

  @Column({ name: "fee_billed_at", type: "timestamptz", nullable: true })
  feeBilledAt!: Date | null;

  @Column({ name: "fee_billed_by", type: "uuid", nullable: true })
  feeBilledBy!: string | null;

  @Column({ name: "series_id", type: "uuid", nullable: true })
  seriesId!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
