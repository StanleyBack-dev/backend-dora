import { Field, ObjectType } from "@nestjs/graphql";
import { PixKeyType } from "@/shared/domain/pix";
import "@/common/graphql/pix-key-type.enum";

@ObjectType("EventPix", {
  description: "Quem recebe o PIX (chave, nome, cidade).",
})
export class EventPixType {
  @Field(() => PixKeyType)
  keyType!: PixKeyType;

  @Field()
  key!: string;

  @Field()
  name!: string;

  @Field()
  city!: string;
}
