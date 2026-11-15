import { Field, ID, ObjectType } from "@nestjs/graphql";
import { DocumentType } from "@/shared/domain/identity-document";
import "@/modules/bookings/presentation/graphql/bookings.graphql-enums";

@ObjectType("BookingGuest", {
  description: "Convidado de uma reserva.",
})
export class BookingGuestType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  bookingId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, {
    nullable: true,
    description: "Documento informado (null: não pedido).",
  })
  document!: string | null;

  @Field(() => DocumentType, {
    nullable: true,
    description: "CPF ou RG (null: sem documento).",
  })
  documentType!: DocumentType | null;

  @Field(() => String, { nullable: true, description: "Telefone, só dígitos." })
  phone!: string | null;

  @Field(() => String, {
    description: "Código do convite (QR) que a portaria confere.",
  })
  code!: string;

  @Field(() => Date, {
    nullable: true,
    description: "Quando entrou (portaria).",
  })
  checkedInAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;
}
