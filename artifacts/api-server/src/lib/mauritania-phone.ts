const toAsciiDigits = (value: string) => value
  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));

export const normalizeMauritaniaPhone = (value: string): string | null => {
  const formatted = toAsciiDigits(value).trim();
  if (!/^\+?[0-9\s().-]+$/.test(formatted)) return null;
  const digits = formatted.replace(/\D/g, "");
  const nationalNumber = digits.startsWith("00222") && digits.length === 13
    ? digits.slice(5)
    : digits.startsWith("222") && digits.length === 11
      ? digits.slice(3)
      : digits;

  return /^[234]\d{7}$/.test(nationalNumber)
    ? `+222${nationalNumber}`
    : null;
};

export const invalidSupportPhoneField = (
  input: { phone: string; whatsappPhone: string },
): "phone" | "whatsappPhone" | null => {
  if (input.phone && !normalizeMauritaniaPhone(input.phone)) return "phone";
  if (input.whatsappPhone && !normalizeMauritaniaPhone(input.whatsappPhone)) return "whatsappPhone";
  return null;
};

export type ListingPhoneFields = {
  contactPhone?: string;
  whatsappPhone?: string | null;
};

type ExistingListingPhones = {
  contactPhone: string | null;
  whatsappPhone: string | null;
};

type NormalizedListingPhones =
  | { ok: true; phones: ListingPhoneFields }
  | { ok: false; field: "contactPhone" | "whatsappPhone" };

export const normalizeListingPhones = (
  input: ListingPhoneFields,
  existing?: ExistingListingPhones,
): NormalizedListingPhones => {
  const phones: ListingPhoneFields = {};

  if (input.contactPhone !== undefined
    && input.contactPhone !== existing?.contactPhone) {
    const normalized = normalizeMauritaniaPhone(input.contactPhone);
    if (!normalized) return { ok: false, field: "contactPhone" };
    phones.contactPhone = normalized;
  }

  if (input.whatsappPhone !== undefined
    && input.whatsappPhone !== existing?.whatsappPhone) {
    if (input.whatsappPhone === null) {
      phones.whatsappPhone = null;
    } else {
      const normalized = normalizeMauritaniaPhone(input.whatsappPhone);
      if (!normalized) return { ok: false, field: "whatsappPhone" };
      phones.whatsappPhone = normalized;
    }
  }

  return { ok: true, phones };
};