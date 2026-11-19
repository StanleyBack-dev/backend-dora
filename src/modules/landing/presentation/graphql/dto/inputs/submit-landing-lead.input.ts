import { Field, InputType } from "@nestjs/graphql";
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import {
  LEAD_LIMITS,
  LeadRole,
  LeadSubject,
  LeadUnitsRange,
} from "@/modules/landing/domain/landing-lead";
import "@/modules/landing/presentation/graphql/landing.graphql-enums";

@InputType({ description: "Mensagem do formulário de contato do site." })
export class SubmitLandingLeadInput {
  @Field()
  @IsString()
  @MaxLength(LEAD_LIMITS.name)
  name!: string;

  @Field()
  @IsEmail()
  @MaxLength(LEAD_LIMITS.email)
  email!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(LEAD_LIMITS.phone)
  phone?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(LEAD_LIMITS.condominium)
  condominium?: string | null;

  @Field(() => LeadRole)
  @IsEnum(LeadRole)
  role!: LeadRole;

  @Field(() => LeadUnitsRange, { nullable: true })
  @IsOptional()
  @IsEnum(LeadUnitsRange)
  unitsRange?: LeadUnitsRange | null;

  @Field(() => LeadSubject)
  @IsEnum(LeadSubject)
  subject!: LeadSubject;

  @Field()
  @IsString()
  @MaxLength(LEAD_LIMITS.message)
  message!: string;

  @Field({ description: "Aceite da política de privacidade (obrigatório)." })
  @IsBoolean()
  @Equals(true)
  consent!: boolean;

  @Field(() => String, {
    nullable: true,
    description: "Id anônimo do visitante (analytics).",
  })
  @IsOptional()
  @IsUUID()
  visitorId?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(LEAD_LIMITS.referrerHost)
  referrerHost?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(LEAD_LIMITS.attribution)
  utmSource?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(LEAD_LIMITS.attribution)
  utmMedium?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(LEAD_LIMITS.attribution)
  utmCampaign?: string | null;
}
