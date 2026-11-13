import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CLOCK } from "@/shared/application/ports/clock.port";
import { IMAGE_PROCESSOR } from "@/shared/application/ports/image-processor.port";
import { LOCK } from "@/shared/application/ports/lock.port";
import { OBJECT_STORAGE } from "@/shared/application/ports/object-storage.port";
import { RATE_LIMIT } from "@/shared/application/ports/rate-limit.port";
import { SharpImageProcessor } from "@/shared/infrastructure/sharp-image-processor";
import { SystemClock } from "@/shared/infrastructure/system-clock";
import { LeaseLockRepository } from "@/shared/infrastructure/persistence/lease-lock.repository";
import { LockOrmEntity } from "@/shared/infrastructure/persistence/lock.orm-entity";
import { RateLimitRepository } from "@/shared/infrastructure/persistence/rate-limit.repository";
import { NeonObjectStorageAdapter } from "@/shared/infrastructure/storage/neon-object-storage.adapter";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([LockOrmEntity])],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: LOCK, useClass: LeaseLockRepository },
    { provide: RATE_LIMIT, useClass: RateLimitRepository },
    { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessor },
    { provide: OBJECT_STORAGE, useClass: NeonObjectStorageAdapter },
  ],
  exports: [CLOCK, LOCK, RATE_LIMIT, IMAGE_PROCESSOR, OBJECT_STORAGE],
})
export class SharedModule {}
