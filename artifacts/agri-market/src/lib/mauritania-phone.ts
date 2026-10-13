export const normalizeMauritaniaPhone = (value: string): string | null => {
  const formatted = value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .trim();
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

export const hasAllowedMauritaniaPhonePrefix = (value: string): boolean => {
  const formatted = value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .trim();
  const digits = formatted.replace(/\D/g, "");
  if (!digits) return true;

  if (formatted.startsWith("+")) {
    if (digits.length < 3) return "222".startsWith(digits);
    if (!digits.startsWith("222")) return false;
    return !digits.slice(3) || /^[234]/.test(digits.slice(3));
  }

  if (digits.startsWith("00222")) {
    return !digits.slice(5) || /^[234]/.test(digits.slice(5));
  }
  if ("00222".startsWith(digits)) return true;

  const nationalNumber = digits.startsWith("222") && digits.length >= 11
    ? digits.slice(3)
    : digits;
  return !nationalNumber || /^[234]/.test(nationalNumber);
};

export const getMauritaniaPhoneInputValue = (value: string): string => {
  const normalized = normalizeMauritaniaPhone(value);
  return normalized ? normalized.slice(4) : value;
};