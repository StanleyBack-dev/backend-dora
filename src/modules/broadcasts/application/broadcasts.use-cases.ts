import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import type { UserGroup } from "@/modules/access-control/domain/user-group";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  BROADCAST_REPOSITORY,
  type BroadcastRepositoryPort,
  type BroadcastView,
} from "@/modules/broadcasts/application/ports/broadcast-repository.port";
import {
  BroadcastAudience,
  normalizeBroadcast,
  type BroadcastDraft,
  type BroadcastViolation,
} from "@/modules/broadcasts/domain/broadcast";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";

const VIOLATION_MESSAGES: Record<BroadcastViolation, string> = {
  "title-length": "O título deve ter de 3 a 120 caracteres.",
  "body-length": "A mensagem deve ter de 3 a 2000 caracteres.",
  "group-required": "Escolha o grupo que recebe o comunicado.",
};

const HISTORY_LIMIT = 50;

@Injectable()
export class BroadcastsUseCase {
  constructor(
    @Inject(BROADCAST_REPOSITORY)
    private readonly broadcasts: BroadcastRepositoryPort,
    private readonly users: UserLookupService,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  list(): Promise<BroadcastView[]> {
    return this.broadcasts.list(HISTORY_LIMIT);
  }

  async send(
    actor: AuthenticatedUser,
    input: BroadcastDraft,
  ): Promise<BroadcastView> {
    const draft = normalizeBroadcast(input);
    if (typeof draft === "string") {
      throw AppException.from(APP_ERRORS.broadcasts.invalid, {
        reason: VIOLATION_MESSAGES[draft],
      });
    }

    const userIds =
      draft.audience === BroadcastAudience.GRUPO
        ? await this.users.activeUserIdsInGroup(draft.targetGroup as UserGroup)
        : await this.users.activeUserIds();
    if (userIds.length === 0) {
      throw AppException.from(APP_ERRORS.broadcasts.noRecipients, undefined);
    }

    const saved = await this.broadcasts.create(
      {
        ...draft,
        recipients: userIds.length,
        createdBy: actor.id,
      },
      (broadcastId) =>
        userIds.map((userId) =>
          deliveryDraft(
            {
              userId,
              type: NotificationType.BROADCAST,
              title: draft.title,
              body: draft.body,
              link: "/notificacoes",
              email: draft.sendEmail
                ? {
                    subject: `Comunicado: ${draft.title}`,
                    intro: draft.body,
                    details: [{ label: "Enviado por", value: actor.name }],
                    ctaLabel: "Abrir o Dora",
                  }
                : null,
              calendar: null,
            },
            `broadcast:${broadcastId}:${userId}`,
          ),
        ),
    );
    this.outbox.kick();

    await this.audit.stamp({
      actorId: actor.id,
      entity: "broadcast",
      entityId: saved.id,
      created: true,
    });
    return saved;
  }
}
