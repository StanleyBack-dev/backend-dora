import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import type { LostFoundDeclarationService } from "@/modules/lost-and-found/application/lost-found-declaration.service";
import type { GetReturnReceiptUseCase } from "@/modules/lost-and-found/application/use-cases/get-return-receipt.use-case";
import type { ListFoundItemsUseCase } from "@/modules/lost-and-found/application/use-cases/list-found-items.use-case";
import { FoundItemStatus } from "@/modules/lost-and-found/domain/found-item";
import type { FoundItemType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item.output";
import { FoundItemFieldsResolver } from "@/modules/lost-and-found/presentation/graphql/found-item-fields.resolver";
import type { ObjectStoragePort } from "@/shared/application/ports/object-storage.port";

const owner = { id: "resident-1" } as AuthenticatedUser;
const other = { id: "resident-2" } as AuthenticatedUser;
const gate = { id: "gate-1" } as AuthenticatedUser;

const returned = {
  id: "item-1",
  status: FoundItemStatus.RETURNED,
  returnedToId: "resident-1",
  returnedToNameRaw: "Maria",
  signerNameRaw: "Maria Souza",
} as FoundItemType;

function setup() {
  const receipts = { execute: jest.fn().mockResolvedValue(null) };
  const resolver = new FoundItemFieldsResolver(
    {
      canManage: jest.fn((actor: AuthenticatedUser) =>
        Promise.resolve(actor.id === "gate-1"),
      ),
    } as unknown as LostFoundAccessService,
    {} as ListFoundItemsUseCase,
    {} as LostFoundDeclarationService,
    receipts as unknown as GetReturnReceiptUseCase,
    {} as ObjectStoragePort,
  );
  return { resolver, receipts };
}

describe("FoundItemFieldsResolver (who sees a return)", () => {
  it("shows who took it to the staff and to the resident it went back to", async () => {
    const { resolver } = setup();
    await expect(resolver.signerName(returned, gate)).resolves.toBe(
      "Maria Souza",
    );
    await expect(resolver.returnedToName(returned, owner)).resolves.toBe(
      "Maria",
    );
  });

  it("hides who took it, and the receipt, from other residents", async () => {
    const { resolver, receipts } = setup();
    await expect(resolver.signerName(returned, other)).resolves.toBeNull();
    await expect(resolver.returnedToName(returned, other)).resolves.toBeNull();
    await expect(resolver.returnReceipt(returned, other)).resolves.toBeNull();
    expect(receipts.execute).not.toHaveBeenCalled();
  });

  it("loads the receipt for the resident it went back to", async () => {
    const { resolver, receipts } = setup();
    await resolver.returnReceipt(returned, owner);
    expect(receipts.execute).toHaveBeenCalledWith("item-1");
  });
});
