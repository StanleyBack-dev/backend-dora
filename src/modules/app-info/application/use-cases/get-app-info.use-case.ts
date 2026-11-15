import { Inject, Injectable } from "@nestjs/common";
import {
  BUILD_INFO,
  type BuildInfo,
  type BuildInfoPort,
} from "@/modules/app-info/application/ports/build-info.port";

// The API's version and commit, shown in "Sobre o Dora" next to the web
// app's, so a report always says which builds were running.
@Injectable()
export class GetAppInfoUseCase {
  constructor(@Inject(BUILD_INFO) private readonly build: BuildInfoPort) {}

  execute(): BuildInfo {
    return this.build.current();
  }
}
