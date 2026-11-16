import { Field, ID, ObjectType } from "@nestjs/graphql";
import {
  DependentRelationship,
  DependentStatus,
} from "@/modules/dependents/domain/dependent";
import "@/modules/dependents/presentation/graphql/dependents.graphql-enums";

@ObjectType("Dependent", {
  description: "Dependente de um morador (aprovado pela administração).",
})
export class DependentType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ description: "Data de nascimento (AAAA-MM-DD)." })
  birthDate!: string;

  @Field(() => DependentRelationship)
  relationship!: DependentRelationship;

  @Field(() => DependentStatus)
  status!: DependentStatus;

  @Field(() => String, { nullable: true, description: "Morador responsável." })
  holderName!: string | null;

  @Field(() => String, { nullable: true })
  unitLabel!: string | null;

  @Field(() => String, { nullable: true })
  rejectReason!: string | null;

  @Field(() => Date, { nullable: true })
  reviewedAt!: Date | null;

  @Field()
  createdAt!: Date;

  /** Resolved into a signed link by the `documentUrl` field. */
  documentKey!: string;

  @Field({ description: "Tipo do documento (imagem ou PDF)." })
  documentContentType!: string;
}
