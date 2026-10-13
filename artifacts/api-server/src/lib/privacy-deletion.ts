export type AccountDeletionSnapshot = {
  clerkUserId: string;
  personalObjectPaths: string[];
};

export type AccountDeletionStore = {
  begin: (clerkUserId: string) => Promise<AccountDeletionSnapshot | null>;
  eraseMarketplaceData: (clerkUserId: string) => Promise<string[]>;
  finalize: (clerkUserId: string) => Promise<void>;
};

export type AccountDeletionDependencies = {
  store: AccountDeletionStore;
  deleteObject: (objectPath: string) => Promise<void>;
  deleteClerkUser: (clerkUserId: string) => Promise<void>;
};

export async function deleteMarketplaceAccount(
  clerkUserId: string,
  dependencies: AccountDeletionDependencies,
): Promise<boolean> {
  const snapshot = await dependencies.store.begin(clerkUserId);
  if (!snapshot) return false;
  if (snapshot.clerkUserId !== clerkUserId) {
    throw new Error("Account deletion snapshot does not match the authenticated user");
  }

  for (const objectPath of new Set(snapshot.personalObjectPaths)) {
    await dependencies.deleteObject(objectPath);
  }

  const remainingObjectPaths = await dependencies.store.eraseMarketplaceData(clerkUserId);
  for (const objectPath of new Set(remainingObjectPaths)) {
    await dependencies.deleteObject(objectPath);
  }
  await dependencies.deleteClerkUser(clerkUserId);
  await dependencies.store.finalize(clerkUserId);
  return true;
}
