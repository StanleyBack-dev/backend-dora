import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("Unit", { description: "Unidade (apartamento, casa)." })
export class UnitType {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'Rua (casas; "" em apartamentos).' })
  street!: string;

  @Field({
    description: 'Bloco ou torre; em casas, a quadra ("" quando não há).',
  })
  block!: string;

  @Field({ description: "Número; em casas, o lote." })
  number!: string;

  @Field({
    description:
      'Como exibir: "Bloco A · 101" ou "Rua das Flores, Qd 3, Lt 12".',
  })
  label!: string;

  @Field(() => Int, { description: "Membros ativos vinculados." })
  residents!: number;
}
