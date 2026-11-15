import { Module } from "@nestjs/common";
import { BUILD_INFO } from "@/modules/app-info/application/ports/build-info.port";
import { GetAppInfoUseCase } from "@/modules/app-info/application/use-cases/get-app-info.use-case";
import { EnvBuildInfoAdapter } from "@/modules/app-info/infrastructure/env-build-info.adapter";
import { AppInfoResolver } from "@/modules/app-info/presentation/graphql/app-info.resolver";

// Which build of the API is running (version and commit).
@Module({
  providers: [
    GetAppInfoUseCase,
    AppInfoResolver,
    { provide: BUILD_INFO, useClass: EnvBuildInfoAdapter },
  ],
})
export class AppInfoModule {}
