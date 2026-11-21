import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import {
  FoundItemCategory,
  FoundItemStatus,
} from "@/modules/lost-and-found/domain/found-item";
import "@/modules/lost-and-found/presentation/graphql/lost-found.graphql-enums";

@ObjectType("FoundItem", { description: "Item achado no condomínio." })
export class FoundItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => FoundItemCategory)
  category!: FoundItemCategory;

  @Field({ description: "O que é (ex.: chave com chaveiro azul)." })
  title!: string;

  @Field(() => String, {
    nullable: true,
    description: "O que os moradores veem sobre o item.",
  })
  description!: string | null;

  @Field({ description: "Onde foi achado." })
  foundLocation!: string;

  @Field()
  foundAt!: Date;

  @Field({ description: "Onde está guardado." })
  storageLocation!: string;

  @Field({ description: "A foto não aparece para os moradores." })
  photoHidden!: boolean;

  @Field(() => FoundItemStatus)
  status!: FoundItemStatus;

  @Field(() => String, { nullable: true })
  registeredByName!: string | null;

  @Field({ description: "Guardado até (depois: doado ou descartado)." })
  keepUntil!: Date;

  @Field(() => Date, { nullable: true })
  closedAt!: Date | null;

  @Field(() => String, { nullable: true })
  closedByName!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Por que foi doado ou descartado.",
  })
  closeReason!: string | null;

  @Field(() => Int, { description: "Pedidos aguardando a portaria." })
  pendingClaims!: number;

  @Field(() => String, {
    nullable: true,
    description:
      "Reservado pela portaria para esta unidade (nulo: qualquer morador pode pedir).",
  })
  ownerUnitLabel!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Reservado para este morador da unidade.",
  })
  ownerName!: string | null;

  /** Whose accepted claim it waits for (shown to the desk only). */
  awaitedByNameRaw!: string | null;

  /** For the photo link and the staff-only details (not exposed). */
  photoKey!: string | null;
  privateDetailsRaw!: string | null;
  /** Who it went back to (shown to the staff and to that resident). */
  returnedToId!: string | null;
  returnedToNameRaw!: string | null;
  signerNameRaw!: string | null;
  condominiumId!: string;
}
