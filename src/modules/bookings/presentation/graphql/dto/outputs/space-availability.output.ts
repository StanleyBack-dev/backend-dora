import { Field, ID, ObjectType } from "@nestjs/graphql";
import { AvailabilitySlotType } from "@/modules/bookings/presentation/graphql/dto/outputs/availability-slot.output";

@ObjectType("SpaceAvailability", {
  description: "A grade de horários de um espaço em um dia.",
})
export class SpaceAvailabilityType {
  @Field(() => ID)
  spaceId!: string;

  @Field({ description: "YYYY-MM-DD." })
  date!: string;

  @Field({ description: "Primeiro dia reservável (hoje)." })
  firstDate!: string;

  @Field({ description: "Último dia com agenda aberta." })
  lastDate!: string;

  @Field(() => [AvailabilitySlotType], {
    description: "Vazio: o espaço não abre neste dia.",
  })
  slots!: AvailabilitySlotType[];
}
