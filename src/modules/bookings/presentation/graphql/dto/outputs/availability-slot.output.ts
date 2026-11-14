import { Field, ID, ObjectType } from "@nestjs/graphql";
import { SlotState } from "@/modules/bookings/application/use-cases/get-space-availability.use-case";
import { BookingStatus } from "@/modules/bookings/domain/booking";
import "@/modules/bookings/presentation/graphql/bookings.graphql-enums";

@ObjectType("AvailabilitySlot", { description: "Um horário da grade do dia." })
export class AvailabilitySlotType {
  @Field()
  startsAt!: Date;

  @Field()
  endsAt!: Date;

  @Field(() => SlotState)
  state!: SlotState;

  @Field(() => ID, {
    nullable: true,
    description: "A reserva no horário (a sua, ou qualquer uma para gestores).",
  })
  bookingId!: string | null;

  @Field(() => BookingStatus, { nullable: true })
  bookingStatus!: BookingStatus | null;

  @Field(() => String, {
    nullable: true,
    description: "Quem reservou (gestores) ou o motivo do bloqueio.",
  })
  label!: string | null;
}
