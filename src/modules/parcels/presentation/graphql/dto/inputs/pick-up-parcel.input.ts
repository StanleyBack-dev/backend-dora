import { Field, InputType } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { DocumentType } from "@/shared/domain/identity-document";
import {
  SignatureDeviceInput,
  SignatureLocationInput,
} from "@/common/graphql/signature.inputs";
import "@/modules/parcels/presentation/graphql/parcels.graphql-enums";

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
