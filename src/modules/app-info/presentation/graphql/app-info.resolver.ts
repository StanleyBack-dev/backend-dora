import { Query, Resolver } from "@nestjs/graphql";
import { Public } from "@/common/decorators/public.decorator";
import type { BuildInfo } from "@/modules/app-info/application/ports/build-info.port";
import { GetAppInfoUseCase } from "@/modules/app-info/application/use-cases/get-app-info.use-case";
import { AppInfoType } from "@/modules/app-info/presentation/graphql/dto/outputs/app-info.output";

// Public: the version is no secret, and the BFF reads it without a session.
@Resolver()
export class AppInfoResolver {
  constructor(private readonly getAppInfo: GetAppInfoUseCase) {}

  @Public()
  @Query(() => AppInfoType, {
    description: "Versão e commit da API em execução.",
  })
  appInfo(): BuildInfo {
    return this.getAppInfo.execute();
  }
}
