import { Field, ID, ObjectType } from "@nestjs/graphql";
import { BookingStatus } from "@/modules/bookings/domain/booking";
import { SpaceKind } from "@/modules/spaces/domain/space";
import "@/modules/bookings/presentation/graphql/bookings.graphql-enums";
import "@/modules/spaces/presentation/graphql/spaces.graphql-enums";

@ObjectType("Booking", { description: "Reserva de um espaço." })
export class BookingType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  spaceId!: string;

  @Field()
  spaceName!: string;

  @Field(() => SpaceKind)
  spaceKind!: SpaceKind;

  @Field(() => ID)
  userId!: string;

  @Field({ description: "Quem reservou." })
  userName!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Unidade: "Bloco A · 101".',
  })
  unitLabel!: string | null;

  @Field()
  startsAt!: Date;

  @Field()
  endsAt!: Date;

  @Field(() => BookingStatus)
  status!: BookingStatus;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field({ description: "Até quando quem reservou pode cancelar." })
  cancelUntil!: Date;

  @Field(() => String, {
    nullable: true,
    description: "Motivo da recusa ou do cancelamento pela administração.",
  })
  reason!: string | null;

  @Field(() => Date, { nullable: true })
  decidedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  cancelledAt!: Date | null;

  @Field({ description: "Cancelada por outra pessoa (a administração)." })
  cancelledByManager!: boolean;

  @Field()
  createdAt!: Date;
}
