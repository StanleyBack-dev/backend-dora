import { Field, Int, ObjectType } from "@nestjs/graphql";
import { type Dashboard } from "@/modules/dashboard/application/ports/dashboard-reader.port";

@ObjectType("Dashboard", { description: "Painel do gestor do condomínio." })
export class DashboardType implements Dashboard {
  @Field(() => Int, { description: "Membros com acesso ativo." })
  activeUsers!: number;

  @Field(() => Int, { description: "Cadastros aguardando aprovação." })
  pendingEnrollments!: number;

  @Field(() => Int, { description: "Unidades cadastradas." })
  units!: number;

  @Field(() => Int, { description: "Espaços ativos para reserva." })
  activeSpaces!: number;

  @Field(() => Int, { description: "Reservas aguardando aprovação." })
  pendingBookings!: number;

  @Field(() => Int, { description: "Reservas ativas que começam hoje." })
  bookingsToday!: number;

  @Field(() => Int, {
    nullable: true,
    description: "Pedidos de suporte sem resposta (só a plataforma vê).",
  })
  openSupportRequests!: number | null;

  @Field(() => Int, {
    nullable: true,
    description: "Notificações que falharam de vez (só a plataforma vê).",
  })
  failedNotifications!: number | null;
}
