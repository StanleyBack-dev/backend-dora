import { Field, ID, ObjectType } from "@nestjs/graphql";
import { DocumentType } from "@/shared/domain/identity-document";
import { GuestCheckInWindow } from "@/modules/bookings/presentation/graphql/guest-check-in-window";
import "@/modules/bookings/presentation/graphql/bookings.graphql-enums";

@ObjectType("GateGuest", {
  description: "Convidado na lista da portaria.",
})
export class GateGuestType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  bookingId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  document!: string | null;

  @Field(() => DocumentType, {
    nullable: true,
    description: "CPF ou RG (null: sem documento).",
  })
  documentType!: DocumentType | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String)
  code!: string;

  @Field(() => Date, { nullable: true })
  checkedInAt!: Date | null;

  @Field(() => String)
  spaceName!: string;

  @Field(() => Date)
  startsAt!: Date;

  @Field(() => Date)
  endsAt!: Date;

  @Field(() => String, { description: "Quem reservou." })
  hostName!: string;

  @Field(() => String, {
    nullable: true,
    description: "Unidade de quem reservou.",
  })
  unitLabel!: string | null;

  @Field(() => GuestCheckInWindow, {
    description: "Se a entrada já pode ser liberada.",
  })
  checkInWindow!: GuestCheckInWindow;
}
