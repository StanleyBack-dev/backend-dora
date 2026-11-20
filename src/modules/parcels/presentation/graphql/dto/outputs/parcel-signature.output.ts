import { Field, Float, ObjectType } from "@nestjs/graphql";
import { LocationStatus } from "@/modules/parcels/domain/parcel-signature";
import { DocumentType } from "@/shared/domain/identity-document";
import "@/modules/parcels/presentation/graphql/parcels.graphql-enums";

@ObjectType("ParcelSignature", {
  description:
    "Comprovante da retirada: a assinatura eletrônica e as provas que a sustentam.",
})
export class ParcelSignatureType {
  @Field()
  signerName!: string;

  @Field(() => DocumentType, { nullable: true })
  signerDocumentType!: DocumentType | null;

  @Field(() => String, {
    nullable: true,
    description: "Documento informado, mascarado (ex.: ***.456.789-**).",
  })
  signerDocumentMasked!: string | null;

  @Field({ description: "A declaração assinada, como foi exibida." })
  declaration!: string;

  @Field({ description: "Link temporário da imagem da assinatura." })
  imageUrl!: string;

  @Field({ description: "SHA-256 da imagem guardada." })
  imageSha256!: string;

  @Field({ description: "Traços da assinatura (JSON), para reproduzi-la." })
  drawing!: string;

  @Field({ description: "SHA-256 dos traços." })
  strokesSha256!: string;

  @Field({ description: "Data e hora do servidor na assinatura." })
  signedAt!: Date;

  @Field(() => Date, { nullable: true, description: "Hora do aparelho." })
  clientSignedAt!: Date | null;

  @Field(() => String, { nullable: true })
  clientTimeZone!: string | null;

  @Field(() => String, { nullable: true })
  ipAddress!: string | null;

  @Field(() => String, { nullable: true, description: "Navegador." })
  userAgent!: string | null;

  @Field({ description: "O aparelho (JSON: tela, toque/caneta, idioma…)." })
  device!: string;

  @Field(() => LocationStatus)
  locationStatus!: LocationStatus;

  @Field(() => Float, { nullable: true })
  latitude!: number | null;

  @Field(() => Float, { nullable: true })
  longitude!: number | null;

  @Field(() => Float, { nullable: true, description: "Precisão em metros." })
  locationAccuracyMeters!: number | null;

  @Field({ description: "Quem entregou e colheu a assinatura." })
  collectedByName!: string;

  @Field({
    description:
      "Perfil de quem entregou: CONCIERGE (portaria), ADMIN (administração) ou ADMIN_MASTER.",
  })
  collectedByRole!: string;

  @Field({ description: "SHA-256 de todas as provas, gravado na assinatura." })
  evidenceSha256!: string;

  @Field({
    description:
      "As provas guardadas ainda conferem com o SHA-256 gravado (registro íntegro).",
  })
  intact!: boolean;
}
