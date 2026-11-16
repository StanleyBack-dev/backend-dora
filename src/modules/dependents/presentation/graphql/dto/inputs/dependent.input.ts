import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsString, MaxLength } from "class-validator";
import { DependentRelationship } from "@/modules/dependents/domain/dependent";
import "@/modules/dependents/presentation/graphql/dependents.graphql-enums";

// Shape only: the domain checks the content (dependent.ts).
@InputType()
export class DependentInput {
  @Field({ description: "Nome completo." })
  @IsString()
  @MaxLength(200)
  name!: string;

  @Field({ description: "Data de nascimento AAAA-MM-DD." })
  @IsString()
  @MaxLength(10)
  birthDate!: string;

  @Field(() => DependentRelationship)
  @IsEnum(DependentRelationship)
  relationship!: DependentRelationship;

  @Field({
    description:
      "Documento com a data de nascimento (imagem ou PDF em base64, até 1,2 MB).",
  })
  @IsString()
  @MaxLength(1_700_000)
  document!: string;
}
