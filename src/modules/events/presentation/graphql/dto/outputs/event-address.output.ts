import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType("EventAddress", {
  description: "Endereço do local fora do condomínio.",
})
export class EventAddressType {
  @Field({ description: "CEP (8 números)." })
  zip!: string;

  @Field()
  street!: string;

  @Field({ description: 'Número ou "S/N".' })
  number!: string;

  @Field(() => String, { nullable: true })
  complement!: string | null;

  @Field()
  district!: string;

  @Field()
  city!: string;

  @Field({ description: "UF." })
  state!: string;
}
