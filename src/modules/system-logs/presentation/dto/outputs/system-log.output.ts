import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import GraphQLJSON from "graphql-type-json";

@ObjectType("SystemLog", { description: "Registro do log do sistema." })
export class SystemLogType {
  @Field(() => ID)
  id!: string;

  @Field({ description: "INFO, WARN, ERROR ou CRITICAL." })
  level!: string;

  @Field({ description: "API, DATABASE, AUTH, SECURITY, OUTBOX, ROUTINE…" })
  category!: string;

  @Field()
  source!: string;

  @Field()
  message!: string;

  @Field(() => GraphQLJSON, { nullable: true })
  details!: Record<string, unknown> | null;

  @Field(() => ID, { nullable: true })
  userId!: string | null;

  @Field(() => String, { nullable: true })
  userName!: string | null;

  @Field(() => String, { nullable: true })
  ip!: string | null;

  @Field(() => Int, { nullable: true })
  statusCode!: number | null;

  @Field(() => Int, { nullable: true })
  durationMs!: number | null;

  @Field()
  environment!: string;

  @Field()
  createdAt!: Date;
}
