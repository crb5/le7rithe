export type AccountDeletionSnapshot = {
  oidcSubject: string;
  personalObjectPaths: string[];
};

export type AccountDeletionStore = {
  begin: (oidcSubject: string) => Promise<AccountDeletionSnapshot | null>;
  eraseMarketplaceData: (oidcSubject: string) => Promise<string[]>;
  finalize: (oidcSubject: string) => Promise<void>;
};

export type AccountDeletionDependencies = {
  store: AccountDeletionStore;
  deleteObject: (objectPath: string) => Promise<void>;
  deleteIdentityProviderUser: (oidcSubject: string) => Promise<void>;
};

export async function deleteMarketplaceAccount(
  oidcSubject: string,
  dependencies: AccountDeletionDependencies,
): Promise<boolean> {
  const snapshot = await dependencies.store.begin(oidcSubject);
  if (!snapshot) return false;
  if (snapshot.oidcSubject !== oidcSubject) {
    throw new Error("Account deletion snapshot does not match the authenticated user");
  }

  for (const objectPath of new Set(snapshot.personalObjectPaths)) {
    await dependencies.deleteObject(objectPath);
  }

  const remainingObjectPaths = await dependencies.store.eraseMarketplaceData(oidcSubject);
  for (const objectPath of new Set(remainingObjectPaths)) {
    await dependencies.deleteObject(objectPath);
  }
  await dependencies.deleteIdentityProviderUser(oidcSubject);
  await dependencies.store.finalize(oidcSubject);
  return true;
}
