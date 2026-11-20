import { Field, ID, ObjectType } from "@nestjs/graphql";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";
import { DocumentType } from "@/shared/domain/identity-document";
import "@/modules/parcels/presentation/graphql/parcels.graphql-enums";

@ObjectType("Parcel", { description: "Encomenda recebida na portaria." })
export class ParcelType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  unitId!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "A unidade (nulo: removida).",
  })
  unitLabel!: string | null;

  @Field(() => String, { nullable: true })
  recipientName!: string | null;

  @Field({
    description:
      "Registrada para um morador pelo nome: só ele é avisado e a vê (os outros da unidade, não).",
  })
  recipientOnly!: boolean;

  @Field(() => String, { nullable: true })
  carrier!: string | null;

  @Field(() => String, { nullable: true })
  trackingCode!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Onde está guardada na portaria.",
  })
  storageLocation!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Pessoa autorizada a retirar (nulo: nenhuma).",
  })
  authorizedName!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Documento da pessoa autorizada, com o meio à mostra.",
  })
  authorizedDocumentMasked!: string | null;

  @Field(() => DocumentType, {
    nullable: true,
    description: "Tipo do documento da pessoa autorizada.",
  })
  authorizedDocumentType!: DocumentType | null;

  /** The authorized person's document, for the desk only (not exposed). */
  authorizedDocumentRaw!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Quem autorizou.",
  })
  authorizedByName!: string | null;

  @Field(() => Date, { nullable: true, description: "Quando autorizou." })
  authorizedAt!: Date | null;

  @Field({ description: "Perecível: retirar até pickupDeadline." })
  perishable!: boolean;

  @Field(() => Date, {
    nullable: true,
    description: "Perecível: prazo de retirada.",
  })
  pickupDeadline!: Date | null;

  @Field({ description: "Código de retirada (também no QR)." })
  pickupCode!: string;

  @Field(() => ParcelStatus)
  status!: ParcelStatus;

  @Field()
  receivedAt!: Date;

  @Field(() => String, { nullable: true, description: "Quem recebeu." })
  receivedByName!: string | null;

  @Field(() => Date, {
    nullable: true,
    description: "Quando foi retirada, devolvida ou cancelada.",
  })
  closedAt!: Date | null;

  @Field(() => String, {
    nullable: true,
    description: "Quem entregou, devolveu ou cancelou.",
  })
  closedByName!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Motivo da devolução ou do cancelamento.",
  })
  closeReason!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Quem assinou a retirada.",
  })
  signerName!: string | null;

  /** For the photo link (not exposed). */
  photoKey!: string | null;
  condominiumId!: string;
}
