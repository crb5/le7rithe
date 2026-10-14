const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

/**
 * Minimal structural handle to a stored object. Implemented by `StoredFile`
 * in `objectStorage.ts`; kept structural here to avoid a circular import.
 */
export interface AclTarget {
  name: string;
  exists(): Promise<[boolean]>;
  setMetadata(update: { metadata?: Record<string, string> }): Promise<void>;
}

export async function setObjectAclPolicy(
  objectFile: AclTarget,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }

  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}
