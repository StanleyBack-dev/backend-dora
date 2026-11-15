import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  BuildInfo,
  BuildInfoPort,
} from "@/modules/app-info/application/ports/build-info.port";

const SHA = /^[0-9a-f]{7,40}$/i;

// The deploy workflow passes APP_VERSION (package.json, bumped by
// release-please), APP_COMMIT_SHA and APP_DEPLOYED_AT (UTC, ISO 8601) to
// the runtime. Locally, `npm run` exposes the package version and there is
// no commit nor deploy date.
@Injectable()
export class EnvBuildInfoAdapter implements BuildInfoPort {
  private readonly info: BuildInfo;

  constructor(config: ConfigService) {
    const version =
      config.get<string>("APP_VERSION")?.trim() ||
      process.env.npm_package_version?.trim() ||
      "dev";
    const commit = config.get<string>("APP_COMMIT_SHA")?.trim() ?? "";
    const deployedAt = new Date(
      config.get<string>("APP_DEPLOYED_AT")?.trim() ?? "",
    );
    this.info = {
      version,
      commit: SHA.test(commit) ? commit.toLowerCase() : null,
      deployedAt: Number.isNaN(deployedAt.getTime()) ? null : deployedAt,
    };
  }

  current(): BuildInfo {
    return this.info;
  }
}
