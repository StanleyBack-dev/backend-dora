import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import type { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { CatalogAccessService } from "@/modules/catalog/application/catalog-access.service";
import type { BrandRepositoryPort } from "@/modules/catalog/application/ports/brand-repository.port";
import type { ProductRepositoryPort } from "@/modules/catalog/application/ports/product-repository.port";
import { validateProductInput } from "@/modules/catalog/application/product-input";
import { SaveBrandUseCase } from "@/modules/catalog/application/use-cases/save-brand.use-case";
import type { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { assertCatalogAvailable } from "@/modules/purchases/application/purchase-request-catalog";

const actor = {
  id: "u1",
  condominiumId: "c1",
} as AuthenticatedUser;

const access = (modules: AppModule[], permissions: Permission[]) =>
  new CatalogAccessService(
    {
      enabled: jest.fn().mockResolvedValue(modules),
    } as unknown as ModuleAccessService,
    {
      effectiveFor: jest.fn().mockResolvedValue(new Set(permissions)),
    } as unknown as PermissionsService,
  );

const refused = {
  response: expect.objectContaining({ code: "ACCESS_MISSING_PERMISSION" }),
};

describe("CatalogAccessService", () => {
  it("opens to whoever asks for purchases where the module is on", async () => {
    await expect(
      access([AppModule.PURCHASES], [Permission.PURCHASES_REQUEST]).usableBy(
        actor,
      ),
    ).resolves.toBe("c1");
  });

  it("leaves managing to the purchases management", async () => {
    await expect(
      access([AppModule.PURCHASES], [Permission.PURCHASES_REQUEST]).managedBy(
        actor,
      ),
    ).rejects.toMatchObject(refused);
    await expect(
      access([AppModule.PURCHASES], [Permission.PURCHASES_MANAGE]).managedBy(
        actor,
      ),
    ).resolves.toBe("c1");
  });

  it("stays closed without a module that uses it", async () => {
    await expect(
      access([AppModule.PARCELS], [Permission.PURCHASES_MANAGE]).usableBy(
        actor,
      ),
    ).rejects.toMatchObject(refused);
  });
});

describe("validateProductInput", () => {
  it("normalizes the name, the unit and the description", () => {
    expect(
      validateProductInput({
        name: "  Lâmpada   LED 9W ",
        unit: " un ",
        description: "  ",
      }),
    ).toEqual({ name: "Lâmpada LED 9W", unit: "un", description: null });
  });

  it.each([
    ["a short name", { name: "L", unit: "un" }],
    ["no unit", { name: "Lâmpada", unit: " " }],
    [
      "a long description",
      { name: "Lâmpada", unit: "un", description: "x".repeat(301) },
    ],
  ])("refuses %s", (_label, input) => {
    expect(() => validateProductInput(input)).toThrow();
  });
});

describe("SaveBrandUseCase", () => {
  it("refuses a name already used there, whatever the case", async () => {
    const brands = {
      findByName: jest.fn().mockResolvedValue({ id: "b1", name: "Bosch" }),
      create: jest.fn(),
    } as unknown as jest.Mocked<BrandRepositoryPort>;
    const useCase = new SaveBrandUseCase(
      brands,
      access([AppModule.PURCHASES], [Permission.PURCHASES_REQUEST]),
      { stamp: jest.fn() } as unknown as AuditTrailService,
    );
    await expect(useCase.create(actor, "  bosch ")).rejects.toMatchObject({
      response: expect.objectContaining({ code: "BRAND_NAME_TAKEN" }),
    });
    expect(brands.create).not.toHaveBeenCalled();
  });
});

describe("assertCatalogAvailable", () => {
  const catalog = (activeProducts: string[], activeBrands: string[]) => ({
    products: {
      activeIds: jest.fn((_c: string, ids: string[]) =>
        Promise.resolve(ids.filter((id) => activeProducts.includes(id))),
      ),
    } as unknown as ProductRepositoryPort,
    brands: {
      activeIds: jest.fn((_c: string, ids: string[]) =>
        Promise.resolve(ids.filter((id) => activeBrands.includes(id))),
      ),
    } as unknown as BrandRepositoryPort,
  });
  const item = (productId: string, brandId: string | null) => ({
    productId,
    brandId,
    quantity: 1,
    unit: "un",
    note: null,
  });

  it("accepts active products and brands", async () => {
    await expect(
      assertCatalogAvailable(catalog(["p1"], ["b1"]), "c1", [item("p1", "b1")]),
    ).resolves.toBeUndefined();
  });

  it("refuses an inactive one, unless the request already had it", async () => {
    await expect(
      assertCatalogAvailable(catalog([], ["b1"]), "c1", [item("p1", "b1")]),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "PURCHASE_CATALOG_UNAVAILABLE",
      }),
    });
    await expect(
      assertCatalogAvailable(
        catalog([], []),
        "c1",
        [item("p1", "b1")],
        [{ productId: "p1", brandId: "b1" }],
      ),
    ).resolves.toBeUndefined();
  });
});
