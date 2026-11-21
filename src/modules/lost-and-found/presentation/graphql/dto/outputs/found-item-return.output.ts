import { Field, Float, ID, ObjectType } from "@nestjs/graphql";
import "@/common/graphql/signature.graphql-enums";
import { DocumentType } from "@/shared/domain/identity-document";
import { LocationStatus } from "@/shared/domain/signature/signature-capture";

@ObjectType("FoundItemReturn", {
  description:
    "Comprovante da devolução: a assinatura eletrônica e as provas que a sustentam.",
})
export class FoundItemReturnType {
  @Field(() => ID, { nullable: true, description: "O pedido atendido." })
  claimId!: string | null;

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

  @Field()
  imageSha256!: string;

  @Field()
  strokesSha256!: string;

  @Field({ description: "Data e hora do servidor na assinatura." })
  signedAt!: Date;

  @Field(() => Date, { nullable: true })
  clientSignedAt!: Date | null;

  @Field(() => String, { nullable: true })
  clientTimeZone!: string | null;

  @Field(() => String, { nullable: true })
  ipAddress!: string | null;

  @Field(() => String, { nullable: true })
  userAgent!: string | null;

  @Field({ description: "O aparelho (JSON)." })
  device!: string;

  @Field(() => LocationStatus)
  locationStatus!: LocationStatus;

  @Field(() => Float, { nullable: true })
  latitude!: number | null;

  @Field(() => Float, { nullable: true })
  longitude!: number | null;

  @Field(() => Float, { nullable: true })
  locationAccuracyMeters!: number | null;

  @Field()
  collectedByName!: string;

  @Field({ description: "CONCIERGE (portaria), ADMIN ou ADMIN_MASTER." })
  collectedByRole!: string;

  @Field()
  evidenceSha256!: string;

  @Field({ description: "As provas ainda conferem com o SHA-256 gravado." })
  intact!: boolean;

  @Field({
    description:
      "Entregue pela própria pessoa que pediu, por ser a única da equipe no momento.",
  })
  selfHandover!: boolean;
}
