import { Inject, Injectable } from "@nestjs/common";
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from "@/modules/identity/application/ports/session-repository.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, this.clock.now());
  }
}
