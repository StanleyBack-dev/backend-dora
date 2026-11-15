import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import {
  AddressFormat,
  CondominiumStatus,
} from "@/modules/condominiums/domain/condominium";
import "@/modules/condominiums/presentation/graphql/condominiums.graphql-enums";

@ObjectType("Condominium", {
  description: "Condomínio cliente, como o console da plataforma o mostra.",
})
export class CondominiumType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true, description: "CNPJ (só dígitos)." })
  document!: string | null;

  @Field()
  city!: string;

  @Field()
  state!: string;

  @Field(() => CondominiumStatus)
  status!: CondominiumStatus;

  @Field(() => AddressFormat, {
    description: "Apartamentos (bloco e número) ou casas (rua, quadra e lote).",
  })
  addressFormat!: AddressFormat;

  @Field(() => Int, { description: "Membros ativos." })
  activeMembers!: number;

  @Field(() => Int, { description: "Gestores ativos." })
  managers!: number;

  @Field(() => Int)
  units!: number;

  @Field(() => Int, { description: "Cadastros aguardando aprovação." })
  pendingEnrollments!: number;

  @Field(() => Date, {
    nullable: true,
    description: "Último login de algum membro.",
  })
  lastActivityAt!: Date | null;

  @Field()
  createdAt!: Date;
}
