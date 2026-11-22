import { Field, ID, ObjectType } from "@nestjs/graphql";
import { SupplierDocumentType } from "@/modules/purchases/domain/supplier";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";

@ObjectType("SupplierNameOption", {
  description:
    "Um fornecedor no filtro “Nome” (nome fantasia ou razão social).",
})
export class SupplierNameOptionType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType("SupplierDocumentOption", {
  description: "Um CNPJ/CPF no filtro de documento.",
})
export class SupplierDocumentOptionType {
  @Field(() => SupplierDocumentType)
  documentType!: SupplierDocumentType;

  @Field({ description: "Só os números." })
  document!: string;
}

@ObjectType("SupplierFilterOptions", {
  description:
    "O que os filtros dos fornecedores oferecem: os nomes, contatos e documentos em uso.",
})
export class SupplierFilterOptionsType {
  @Field(() => [SupplierNameOptionType])
  suppliers!: SupplierNameOptionType[];

  @Field(() => [String])
  contacts!: string[];

  @Field(() => [SupplierDocumentOptionType])
  documents!: SupplierDocumentOptionType[];
}
