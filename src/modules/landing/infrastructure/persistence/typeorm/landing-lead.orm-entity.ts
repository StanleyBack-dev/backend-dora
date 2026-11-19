import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import {
  LeadMailStatus,
  LeadRole,
  LeadSubject,
  LeadUnitsRange,
} from "@/modules/landing/domain/landing-lead";

@Entity("tb_landing_leads")
@Index(["createdAt"])
export class LandingLeadOrmEntity {
  @PrimaryGeneratedColumn("uuid", { name: "idtb_landing_leads" })
  id!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "varchar", length: 160 })
  email!: string;

  @Column({ type: "varchar", length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: "varchar", length: 160, nullable: true })
  condominium!: string | null;

  @Column({ type: "varchar", length: 16 })
  role!: LeadRole;

  @Column({ name: "units_range", type: "varchar", length: 16, nullable: true })
  unitsRange!: LeadUnitsRange | null;

  @Column({ type: "varchar", length: 16 })
  subject!: LeadSubject;

  @Column({ type: "varchar", length: 3000 })
  message!: string;

  @Column({ name: "visitor_id", type: "uuid", nullable: true })
  visitorId!: string | null;

  @Column({
    name: "referrer_host",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  referrerHost!: string | null;

  @Column({ name: "utm_source", type: "varchar", length: 100, nullable: true })
  utmSource!: string | null;

  @Column({ name: "utm_medium", type: "varchar", length: 100, nullable: true })
  utmMedium!: string | null;

  @Column({
    name: "utm_campaign",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  utmCampaign!: string | null;

  @Column({
    name: "mail_status",
    type: "varchar",
    length: 8,
    default: LeadMailStatus.PENDING,
  })
  mailStatus!: LeadMailStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
