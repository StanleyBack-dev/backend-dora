import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("SpacePhoto", { description: "Foto do espaço." })
export class SpacePhotoType {
  @Field(() => ID)
  id!: string;

  @Field({ description: "Link temporário (assinado) da imagem." })
  url!: string;
}
