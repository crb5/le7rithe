export const phoneNameCompletionFlag = "phoneSignInNeedsName";
export const maxPhoneFailedAttemptsPerHour = 10;
export const phoneFailedAttemptsExceeded = (attempts: number): boolean =>
  attempts >= maxPhoneFailedAttemptsPerHour;

export class PhoneAuthError extends Error {
  constructor(readonly status: 400 | 403 | 409, readonly publicMessage: string, readonly code?: string) {
    super(publicMessage);
    this.name = "PhoneAuthError";
  }
}

type PhoneUser = { id: string; phoneNumbers: Array<{ phoneNumber: string }> };
type ProfileMatch = { clerkUserId: string | null; status: string };
type CreateInput = {
  phoneNumber: string[];
  firstName?: string;
  lastName?: string;
  password?: string;
  skipPasswordRequirement: boolean;
  publicMetadata: Record<string, unknown>;
};
type Dependencies<T extends PhoneUser> = {
  findProfiles: () => Promise<ProfileMatch[]>;
  findUsers: () => Promise<T[]>;
  getUser: (id: string) => Promise<T>;
  attachVerifiedPhone: (id: string, phone: string) => Promise<T>;
  createUser: (input: CreateInput) => Promise<T>;
  onCreated?: (user: T) => Promise<void>;
};
const existingNumber = () => new PhoneAuthError(409,
  "هذا الرقم مرتبط بحساب بالفعل. يرجى تسجيل الدخول.", "PHONE_ALREADY_REGISTERED");

export function validatePhoneSignupProfile(input: {
  firstName?: string; lastName?: string; password?: string;
}): { firstName: string; lastName: string; password: string } {
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  if (!firstName || !lastName || firstName.length > 120 || lastName.length > 120) {
    throw new PhoneAuthError(400, "الاسم الأول واسم العائلة مطلوبان لإنشاء الحساب.", "NAME_REQUIRED");
  }
  if (!input.password || input.password.length < 8 || input.password.length > 128) {
    throw new PhoneAuthError(400, "كلمة المرور مطلوبة ويجب أن تتكون من 8 أحرف على الأقل.", "PASSWORD_REQUIRED");
  }
  return { firstName, lastName, password: input.password };
}

// The registration mode and recovery identity must come from the stored
// challenge, never from the verification request.
export async function resolvePhoneAuthUser<T extends PhoneUser>(
  phone: string,
  options: { signup: boolean; firstName?: string; lastName?: string; password?: string; recoveryUserId?: string | null },
  dependencies: Dependencies<T>,
): Promise<T> {
  const [profiles, users] = await Promise.all([dependencies.findProfiles(), dependencies.findUsers()]);
  if (profiles.length > 1 || users.length > 1) {
    throw new PhoneAuthError(409, "رقم الهاتف مرتبط بأكثر من حساب. تواصل مع الدعم.");
  }
  const profile = profiles[0];
  const user = users[0];
  if (options.signup && !options.recoveryUserId && (profile || user)) throw existingNumber();
  if (profile && profile.status !== "active") {
    throw new PhoneAuthError(403, "هذا الحساب غير نشط. تواصل مع الدعم.");
  }
  if (profile && (!profile.clerkUserId || (user && profile.clerkUserId !== user.id))) {
    throw new PhoneAuthError(409, "تعذر ربط رقم الهاتف بالحساب الحالي. تواصل مع الدعم.");
  }
  if (options.recoveryUserId) {
    if (!options.signup || (profile && profile.clerkUserId !== options.recoveryUserId)
      || (user && user.id !== options.recoveryUserId)) throw existingNumber();
    const recovered = await dependencies.getUser(options.recoveryUserId);
    if (!recovered.phoneNumbers.some((number) => number.phoneNumber === phone)) throw existingNumber();
    return recovered;
  }
  if (profile?.clerkUserId) {
    const existing = await dependencies.getUser(profile.clerkUserId);
    if (!existing.phoneNumbers.some((number) => number.phoneNumber === phone)) {
      const repaired = await dependencies.attachVerifiedPhone(existing.id, phone);
      if (!repaired.phoneNumbers.some((number) => number.phoneNumber === phone)) {
        throw new PhoneAuthError(409, "تعذر العثور على الحساب المرتبط بهذا الرقم. تواصل مع الدعم.");
      }
      return repaired;
    }
    return existing;
  }
  if (user) return user;
  const signupProfile = options.signup ? validatePhoneSignupProfile(options) : null;

  let created: T;
  try {
    created = await dependencies.createUser({
      phoneNumber: [phone],
      ...(signupProfile ?? {}),
      skipPasswordRequirement: !options.signup,
      publicMetadata: {
        role: "user",
        [phoneNameCompletionFlag]: !options.signup,
      },
    });
  } catch (error) {
    const concurrent = await dependencies.findUsers();
    if (options.signup && concurrent.length) throw existingNumber();
    const providerErrors = error && typeof error === "object" && "errors" in error
      ? (error as { errors?: Array<{ code?: string }> }).errors
      : undefined;
    if (options.signup && Array.isArray(providerErrors)
      && providerErrors.some((entry) => typeof entry.code === "string" && /(^|_)password(_|$)/.test(entry.code))) {
      throw new PhoneAuthError(400, "كلمة المرور لا تستوفي متطلبات الأمان. اختر كلمة مرور أخرى.", "PASSWORD_REJECTED");
    }
    if (concurrent.length !== 1) throw new Error("Clerk did not create a unique phone user");
    return concurrent[0];
  }
  await dependencies.onCreated?.(created);
  return created;
}

export function phoneChallengeAction(challenge: {
  status: string; expiresAt: Date; updatedAt: Date; failedAttempts: number;
}, now = Date.now()): "invalid" | "exhausted" | "busy" | "check" | "finalize" {
  if (challenge.expiresAt.getTime() <= now
    || !["pending", "checking", "approved", "finalizing"].includes(challenge.status)) return "invalid";
  if (challenge.failedAttempts >= 5) return "exhausted";
  if (["checking", "finalizing"].includes(challenge.status) && challenge.updatedAt.getTime() > now - 60_000) return "busy";
  return ["approved", "finalizing"].includes(challenge.status) ? "finalize" : "check";
}
