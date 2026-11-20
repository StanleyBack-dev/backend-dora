import { Field, Float, InputType, Int } from "@nestjs/graphql";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import "@/common/graphql/signature.graphql-enums";
import { LocationStatus } from "@/shared/domain/signature/signature-capture";

// The device facts sent with an on-screen signature (parcels, lost and
// found): shared input types, declared once in the schema.

@InputType({ description: "Localização do aparelho no momento da assinatura." })
export class SignatureLocationInput {
  @Field(() => LocationStatus)
  @IsEnum(LocationStatus)
  status!: LocationStatus;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  longitude?: number | null;

  @Field(() => Float, { nullable: true, description: "Precisão em metros." })
  @IsOptional()
  @IsNumber()
  accuracyMeters?: number | null;
}

@InputType({ description: "O aparelho em que a assinatura foi feita." })
export class SignatureDeviceInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  platform?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(35)
  language?: string | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  screenWidth?: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  screenHeight?: number | null;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  pixelRatio?: number | null;

  @Field(() => String, {
    nullable: true,
    description: "touch, pen ou mouse: como a assinatura foi feita.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pointerType?: string | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  maxTouchPoints?: number | null;
}
