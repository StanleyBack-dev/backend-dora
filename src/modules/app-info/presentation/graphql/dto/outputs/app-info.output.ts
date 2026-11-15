import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType("AppInfo", { description: "Versão da API em execução." })
export class AppInfoType {
  @Field({ description: 'Versão (ex.: "0.2.0"); "dev" fora de um deploy.' })
  version!: string;

  @Field(() => String, {
    nullable: true,
    description: "Commit do deploy; nulo fora de um deploy.",
  })
  commit!: string | null;
}
