import { Field, ID, ObjectType } from "@nestjs/graphql";
import {
  LeadMailStatus,
  LeadRole,
  LeadSubject,
  LeadUnitsRange,
} from "@/modules/landing/domain/landing-lead";
import "@/modules/landing/presentation/graphql/landing.graphql-enums";

@ObjectType("LandingLead", { description: "Mensagem enviada pelo site." })
export class LandingLeadType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  condominium!: string | null;

  @Field(() => LeadRole)
  role!: LeadRole;

  @Field(() => LeadUnitsRange, { nullable: true })
  unitsRange!: LeadUnitsRange | null;

  @Field(() => LeadSubject)
  subject!: LeadSubject;

  @Field()
  message!: string;

  @Field(() => String, { nullable: true })
  referrerHost!: string | null;

  @Field(() => String, { nullable: true })
  utmSource!: string | null;

  @Field(() => String, { nullable: true })
  utmMedium!: string | null;

  @Field(() => String, { nullable: true })
  utmCampaign!: string | null;

  @Field(() => LeadMailStatus)
  mailStatus!: LeadMailStatus;

  @Field()
  createdAt!: Date;
}
