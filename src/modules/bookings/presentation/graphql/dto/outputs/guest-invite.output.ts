import { Field, ObjectType } from "@nestjs/graphql";
import { GuestInviteStatus } from "@/modules/bookings/domain/booking-guest";
import "@/modules/bookings/presentation/graphql/bookings.graphql-enums";

@ObjectType("GuestInvite", {
  description: "Convite de um convidado (página pública).",
})
export class GuestInviteType {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  guestName!: string;

  @Field(() => String, { description: "Primeiro nome de quem convidou." })
  hostFirstName!: string;

  @Field(() => String)
  spaceName!: string;

  @Field(() => String)
  condominiumName!: string;

  @Field(() => Date)
  startsAt!: Date;

  @Field(() => Date)
  endsAt!: Date;

  @Field(() => GuestInviteStatus)
  status!: GuestInviteStatus;

  @Field(() => Boolean, { description: "Já entrou pela portaria." })
  checkedIn!: boolean;
}
