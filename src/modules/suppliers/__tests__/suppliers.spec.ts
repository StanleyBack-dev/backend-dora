import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import type {
  SupplierData,
  SupplierRepositoryPort,
} from "@/modules/suppliers/application/ports/supplier-repository.port";
import type { SuppliersAccessService } from "@/modules/suppliers/application/suppliers-access.service";
import {
  type SupplierInput,
  validateSupplierInput,
} from "@/modules/suppliers/application/supplier-input";
import { CreateSupplierUseCase } from "@/modules/suppliers/application/use-cases/create-supplier.use-case";
import { SetSupplierActiveUseCase } from "@/modules/suppliers/application/use-cases/set-supplier-active.use-case";
import { UpdateSupplierUseCase } from "@/modules/suppliers/application/use-cases/update-supplier.use-case";
import { Category } from "@/modules/catalog/domain/category";
import {
  type Supplier,
  SupplierDocumentType,
} from "@/modules/suppliers/domain/supplier";
import { PixKeyType } from "@/shared/domain/pix";

const CNPJ = "11.222.333/0001-81";

const input = (overrides: Partial<SupplierInput> = {}): SupplierInput => ({
  documentType: SupplierDocumentType.CNPJ,
  document: CNPJ,
  name: "  Hidráulica   Central Ltda ",
  categories: [Category.OTHER, Category.MAINTENANCE, Category.MAINTENANCE],
  categoryOther: " Dedetização ",
  ...overrides,
});

const supplier = (overrides: Partial<Supplier> = {}): Supplier => ({
  id: "s1",
  condominiumId: "c1",
  documentType: SupplierDocumentType.CNPJ,
  document: "11222333000181",
  name: "Hidráulica Central Ltda",
  tradeName: null,
  categories: [Category.MAINTENANCE],
  categoryOther: null,
  contactName: null,
  email: null,
  phone: null,
  city: null,
  state: null,
  pixKeyType: null,
  pixKey: null,
  notes: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("validateSupplierInput", () => {
  it("normalizes the document, the texts and the categories", () => {
    const data = validateSupplierInput(
      input({
        email: " Compras@Hidraulica.COM ",
        phone: "(62) 99999-0000",
        state: "go",
        pixKeyType: PixKeyType.CNPJ,
        pixKey: CNPJ,
      }),
    );
    expect(data).toMatchObject({
      document: "11222333000181",
      name: "Hidráulica Central Ltda",
      categories: [Category.MAINTENANCE, Category.OTHER],
      categoryOther: "Dedetização",
      email: "compras@hidraulica.com",
      phone: "62999990000",
      state: "GO",
      pixKeyType: PixKeyType.CNPJ,
      pixKey: "11222333000181",
      tradeName: null,
    });
  });

  it.each([
    ["an invalid CNPJ", { document: "11.222.333/0001-00" }],
    [
      "an invalid CPF",
      { documentType: SupplierDocumentType.CPF, document: "123" },
    ],
    [
      "OTHER without its text",
      { categories: [Category.OTHER], categoryOther: " " },
    ],
    ["no categories", { categories: [] }],
    ["a short name", { name: "A" }],
    ["an invalid e-mail", { email: "compras@" }],
    ["an invalid phone", { phone: "1234" }],
    ["an unknown state", { state: "XX" }],
    ["a PIX key without its type", { pixKey: "abc@x.com" }],
    ["an invalid PIX key", { pixKeyType: PixKeyType.EMAIL, pixKey: "abc" }],
  ])("refuses %s", (_label, overrides) => {
    expect(() => validateSupplierInput(input(overrides))).toThrow();
  });
});

describe("supplier use cases", () => {
  const actor = { id: "u1" } as AuthenticatedUser;

  const setup = (existing: Supplier | null, byDocument: Supplier | null) => {
    const repository = {
      find: jest.fn().mockResolvedValue(existing),
      findByDocument: jest.fn().mockResolvedValue(byDocument),
      create: jest.fn((_c: string, data: SupplierData) =>
        Promise.resolve(supplier({ ...data })),
      ),
      update: jest.fn((id: string, data: SupplierData) =>
        Promise.resolve(supplier({ id, ...data })),
      ),
      setActive: jest.fn((id: string, active: boolean) =>
        Promise.resolve(supplier({ id, active })),
      ),
    } as unknown as jest.Mocked<SupplierRepositoryPort>;
    const access = {
      managedBy: jest.fn().mockResolvedValue("c1"),
    } as unknown as SuppliersAccessService;
    const audit = {
      stamp: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditTrailService>;
    return { repository, access, audit };
  };

  it("creates a supplier and stamps who did it", async () => {
    const { repository, access, audit } = setup(null, null);
    const created = await new CreateSupplierUseCase(
      repository,
      access,
      audit,
    ).execute(actor, input());
    expect(created.document).toBe("11222333000181");
    expect(audit.stamp).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "supplier", created: true }),
    );
  });

  it("refuses a document already used in the condominium", async () => {
    const { repository, access, audit } = setup(null, supplier());
    await expect(
      new CreateSupplierUseCase(repository, access, audit).execute(
        actor,
        input(),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SUPPLIER_DOCUMENT_TAKEN" }),
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("updates keeping its own document, refuses another's", async () => {
    const own = setup(supplier(), supplier());
    await expect(
      new UpdateSupplierUseCase(own.repository, own.access, own.audit).execute(
        actor,
        "s1",
        input(),
      ),
    ).resolves.toMatchObject({ id: "s1" });

    const taken = setup(supplier(), supplier({ id: "s2" }));
    await expect(
      new UpdateSupplierUseCase(
        taken.repository,
        taken.access,
        taken.audit,
      ).execute(actor, "s1", input()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SUPPLIER_DOCUMENT_TAKEN" }),
    });
  });

  it("deactivates once, and says when the supplier is not there", async () => {
    const { repository, access, audit } = setup(supplier(), null);
    const useCase = new SetSupplierActiveUseCase(repository, access, audit);
    await expect(useCase.execute(actor, "s1", false)).resolves.toMatchObject({
      active: false,
    });
    await useCase.execute(actor, "s1", true);
    expect(repository.setActive).toHaveBeenCalledTimes(1);

    const missing = setup(null, null);
    await expect(
      new SetSupplierActiveUseCase(
        missing.repository,
        missing.access,
        missing.audit,
      ).execute(actor, "s9", false),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SUPPLIER_NOT_FOUND" }),
    });
  });
});

describe("supplier category", () => {
  it("drops the typed text without OTHER", () => {
    expect(
      validateSupplierInput(
        input({
          categories: [Category.CLEANING],
          categoryOther: "  Dedetização   e pragas ",
        }),
      ),
    ).toMatchObject({
      categories: [Category.CLEANING],
      categoryOther: null,
    });
  });
});
