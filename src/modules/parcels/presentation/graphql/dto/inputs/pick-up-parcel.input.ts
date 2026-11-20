import { Field, Float, InputType, Int } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { LocationStatus } from "@/modules/parcels/domain/parcel-signature";
import { DocumentType } from "@/shared/domain/identity-document";
import "@/modules/parcels/presentation/graphql/parcels.graphql-enums";

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

@InputType({
  description:
    "Entrega da encomenda pelo código de retirada, com a assinatura de quem retira.",
})
export class PickUpParcelInput {
  @Field({ description: "Código de retirada (digitado ou do QR)." })
  @IsString()
  @MaxLength(20)
  code!: string;

  @Field({ description: "Nome completo de quem retira." })
  @IsString()
  @MaxLength(200)
  signerName!: string;

  @Field(() => DocumentType, { nullable: true })
  @IsOptional()
  @IsEnum(DocumentType)
  signerDocumentType?: DocumentType | null;

  @Field(() => String, { nullable: true, description: "CPF ou RG (opcional)." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  signerDocument?: string | null;

  @Field({ description: "A declaração exibida a quem assinou." })
  @IsString()
  @MaxLength(1000)
  declarationShown!: string;

  @Field({ description: "Imagem da assinatura (PNG ou WebP em base64)." })
  @IsString()
  @MaxLength(560_000)
  signatureImage!: string;

  @Field({
    description:
      "Traços da assinatura em JSON: { width, height, strokes: [[x, y, t, pressão]…] }.",
  })
  @IsString()
  @MaxLength(600_000)
  signatureDrawing!: string;

  @Field(() => Date, {
    nullable: true,
    description: "Hora do aparelho ao assinar.",
  })
  @IsOptional()
  @IsDate()
  clientSignedAt?: Date | null;

  @Field(() => String, {
    nullable: true,
    description: "Fuso do aparelho (ex.: America/Sao_Paulo).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientTimeZone?: string | null;

  @Field(() => SignatureLocationInput)
  @ValidateNested()
  @Type(() => SignatureLocationInput)
  location!: SignatureLocationInput;

  @Field(() => SignatureDeviceInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignatureDeviceInput)
  device?: SignatureDeviceInput | null;
}
