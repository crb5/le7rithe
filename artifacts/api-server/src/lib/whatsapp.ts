import { logger } from "./logger";
import { normalizeMauritaniaPhone } from "./mauritania-phone";

/**
 * WhatsApp Cloud API (Meta) template-message sender. Fire-and-forget: never
 * throws, so a failed send (bad token, unapproved template, rate limit, etc.)
 * never affects the real operation (listing status change, message send,
 * payment confirmation) that triggered it — only logged.
 *
 * Requires WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID. If either is
 * unset, sends are silently skipped (so this stays optional in dev/local).
 *
 * Template names/params here must match templates already approved in the
 * Meta Business WhatsApp Manager — this module only calls them by name, it
 * does not create or validate templates.
 */

const GRAPH_API_VERSION = "v19.0";

type TemplateName = "listing_approved" | "listing_rejected" | "new_buyer_message" | "payment_confirmed";

function isConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Converts whatever is stored on a user's account into WhatsApp's expected
 *  `<country code><number>` format with no leading `+`, or null if invalid. */
function toWhatsAppRecipient(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  const normalized = normalizeMauritaniaPhone(rawPhone);
  return normalized ? normalized.replace(/^\+/, "") : null;
}

async function sendTemplate(
  rawPhone: string | null | undefined,
  template: TemplateName,
  params: string[],
): Promise<void> {
  if (!isConfigured()) return;
  const to = toWhatsAppRecipient(rawPhone);
  if (!to) return;

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: template,
            language: { code: "ar" },
            components: params.length
              ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
              : undefined,
          },
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error({ template, status: response.status, body }, "WhatsApp send failed");
    }
  } catch (err) {
    logger.error({ err, template }, "WhatsApp send threw");
  }
}

export function notifyListingApproved(phone: string | null | undefined, sellerName: string, listingTitle: string): void {
  void sendTemplate(phone, "listing_approved", [sellerName, listingTitle]);
}

export function notifyListingRejected(phone: string | null | undefined, listingTitle: string): void {
  void sendTemplate(phone, "listing_rejected", [listingTitle]);
}

export function notifyNewBuyerMessage(phone: string | null | undefined, listingTitle: string): void {
  void sendTemplate(phone, "new_buyer_message", [listingTitle]);
}

export function notifyPaymentConfirmed(phone: string | null | undefined, amount: string, currency: string): void {
  void sendTemplate(phone, "payment_confirmed", [`${amount} ${currency}`]);
}
