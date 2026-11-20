import { Field, ID, InputType } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import {
  SignatureDeviceInput,
  SignatureLocationInput,
} from "@/common/graphql/signature.inputs";
import { DocumentType } from "@/shared/domain/identity-document";

@InputType({
  description:
    "Devolução de um item achado, com a assinatura de quem retira feita na tela.",
})
export class ReturnFoundItemInput {
  @Field(() => ID)
  @IsUUID()
  itemId!: string;

  @Field(() => ID, {
    nullable: true,
    description: "O pedido aceito que ela atende (vazio: sem pedido).",
  })
  @IsOptional()
  @IsUUID()
  claimId?: string | null;

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
  @MaxLength(2000)
  declarationShown!: string;

  @Field({ description: "Imagem da assinatura (PNG ou WebP em base64)." })
  @IsString()
  @MaxLength(600_000)
  signatureImage!: string;

  @Field({ description: "Traços da assinatura (JSON)." })
  @IsString()
  @MaxLength(400_000)
  signatureDrawing!: string;

  @Field(() => Date, { nullable: true, description: "Hora do aparelho." })
  @IsOptional()
  @IsDate()
  clientSignedAt?: Date | null;

  @Field(() => String, { nullable: true })
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
