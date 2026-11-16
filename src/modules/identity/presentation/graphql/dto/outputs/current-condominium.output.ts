import { Field, ID, ObjectType } from "@nestjs/graphql";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import {
  AddressFormat,
  CondominiumStatus,
} from "@/modules/condominiums/domain/condominium";
import "@/modules/condominiums/presentation/graphql/condominiums.graphql-enums";

@ObjectType("CurrentCondominium", {
  description: "Condomínio em que a sessão está trabalhando.",
})
export class CurrentCondominiumType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

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

  @Field(() => [AppModule], {
    description: "Módulos contratados à parte que estão ligados.",
  })
  modules!: AppModule[];
}
