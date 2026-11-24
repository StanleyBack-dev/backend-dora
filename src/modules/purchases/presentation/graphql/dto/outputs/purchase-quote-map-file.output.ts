import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType("PurchaseQuoteMapFile", {
  description: "Mapa de cotação de uma solicitação, em PDF.",
})
export class PurchaseQuoteMapFileType {
  @Field({ description: "Nome sugerido do arquivo." })
  fileName!: string;

  @Field({ description: "application/pdf" })
  mimeType!: string;

  @Field({ description: "O PDF em base64." })
  base64Content!: string;
}
