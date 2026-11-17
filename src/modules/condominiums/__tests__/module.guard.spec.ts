import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import { ModuleGuard } from "@/modules/condominiums/presentation/guards/module.guard";

class Marked {
  @RequireModule(AppModule.BOOKINGS)
  book() {}

  open() {}
}

@RequireModule(AppModule.EVENTS)
class WholeClass {
  order() {}
}

/** A REST-like context for a handler, with the session's condominium. */
const contextFor = (
  target: object,
  handler: () => void,
  condominiumId: string | null,
): ExecutionContext =>
  ({
    getType: () => "http",
    getHandler: () => handler,
    getClass: () => target,
    switchToHttp: () => ({
      getRequest: () => ({ user: { condominiumId } }),
    }),
  }) as unknown as ExecutionContext;

describe("ModuleGuard", () => {
  const assertEnabled = jest.fn();
  const guard = new ModuleGuard(new Reflector(), {
    assertEnabled,
  } as unknown as ModuleAccessService);

  beforeEach(() => assertEnabled.mockReset());

  it("checks the module of a marked operation in the session's condominium", async () => {
    await expect(
      guard.canActivate(contextFor(Marked, Marked.prototype.book, "condo-1")),
    ).resolves.toBe(true);
    expect(assertEnabled).toHaveBeenCalledWith("condo-1", AppModule.BOOKINGS);
  });

  it("reads the module from the class too", async () => {
    await guard.canActivate(
      contextFor(WholeClass, WholeClass.prototype.order, "condo-1"),
    );
    expect(assertEnabled).toHaveBeenCalledWith("condo-1", AppModule.EVENTS);
  });

  it("refuses when the module is off", async () => {
    assertEnabled.mockRejectedValueOnce(new Error("off"));
    await expect(
      guard.canActivate(contextFor(Marked, Marked.prototype.book, "condo-1")),
    ).rejects.toThrow("off");
  });

  it("lets unmarked operations and sessions without a condominium through", async () => {
    await guard.canActivate(
      contextFor(Marked, Marked.prototype.open, "condo-1"),
    );
    await guard.canActivate(contextFor(Marked, Marked.prototype.book, null));
    expect(assertEnabled).not.toHaveBeenCalled();
  });
});
