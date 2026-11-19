import { Field, InputType } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import {
  LANDING_EVENT_LIMITS,
  LandingDevice,
  LandingEventType,
  MAX_EVENTS_PER_BATCH,
} from "@/modules/landing/domain/landing-event";
import "@/modules/landing/presentation/graphql/landing.graphql-enums";

@InputType()
export class LandingEventInput {
  @Field(() => LandingEventType)
  @IsEnum(LandingEventType)
  type!: LandingEventType;

  @Field(() => String, {
    nullable: true,
    description: 'Seção, alvo do clique ("whatsapp:hero"), vídeo…',
  })
  @IsOptional()
  @IsString()
  @MaxLength(LANDING_EVENT_LIMITS.name)
  name?: string | null;

  @Field()
  @IsString()
  @MaxLength(LANDING_EVENT_LIMITS.path)
  path!: string;
}

@InputType({ description: "Um envio do beacon de analytics do site." })
export class RecordLandingEventsInput {
  @Field()
  @IsUUID()
  visitorId!: string;

  @Field()
  @IsUUID()
  sessionId!: string;

  @Field(() => LandingDevice)
  @IsEnum(LandingDevice)
  device!: LandingDevice;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  referrerHost?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmSource?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmMedium?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmCampaign?: string | null;

  @Field(() => [LandingEventInput])
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_EVENTS_PER_BATCH)
  @ValidateNested({ each: true })
  @Type(() => LandingEventInput)
  events!: LandingEventInput[];
}
