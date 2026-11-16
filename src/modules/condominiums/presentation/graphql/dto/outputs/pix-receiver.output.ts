import { Field, ObjectType } from "@nestjs/graphql";
import { PixKeyType } from "@/shared/domain/pix";
import "@/common/graphql/pix-key-type.enum";

@ObjectType("PixReceiver", {
  description: "Quem recebe um PIX: chave, nome e cidade (como no banco).",
})
export class PixReceiverType {
  @Field(() => PixKeyType)
  keyType!: PixKeyType;

  @Field()
  key!: string;

  @Field()
  name!: string;

  @Field()
  city!: string;
}
