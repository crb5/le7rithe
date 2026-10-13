import { expect, test, type Page } from "@playwright/test";

const baseURL =
  process.env.E2E_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : undefined);

const languages = [
  {
    value: "ar",
    direction: "rtl",
    shareLabel: "مشاركة",
    copiedMessage: "تم نسخ رابط الإعلان",
  },
  {
    value: "fr",
    direction: "ltr",
    shareLabel: "Partager",
    copiedMessage: "Lien de l’annonce copié",
  },
  {
    value: "en",
    direction: "ltr",
    shareLabel: "Share",
    copiedMessage: "Listing link copied",
  },
] as const;

async function selectLanguage(page: Page, language: 'ar' | 'fr' | 'en') {
  const selector = page.getByTestId('select-language');
  await selector.click();
  await page.getByTestId(`language-option-${language}`).click();
  await expect(selector).toHaveAttribute('data-language', language);
}

test.describe("listing sharing", () => {
  test.skip(
    !baseURL,
    "Set E2E_BASE_URL to run the listing sharing regression.",
  );

  test.use({ viewport: { width: 390, height: 844 } });

  test("copies the exact listing URL from cards and detail pages in every language", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (
              globalThis as unknown as {
                __copiedListingUrl?: string;
              }
            ).__copiedListingUrl = value;
          },
        },
      });
    });

    for (const language of languages) {
      await page.goto("/listings");

      const languageSelector = page.getByTestId("select-language");
      await selectLanguage(page, language.value);
      await expect(page.locator("html")).toHaveAttribute(
        "lang",
        language.value,
      );
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        language.direction,
      );

      const listingCard = page
        .locator('article[data-testid^="card-listing-"]:visible')
        .first();
      await expect(listingCard).toBeVisible();

      const cardTestId = await listingCard.getAttribute("data-testid");
      const listingId = cardTestId?.replace("card-listing-", "");
      expect(listingId).toMatch(/^\d+$/);

      const cardShareButton = listingCard.getByTestId(
        `button-share-${listingId}`,
      );
      await expect(cardShareButton).toBeVisible();
      await expect(cardShareButton).toHaveAttribute(
        "aria-label",
        language.shareLabel,
      );
      await cardShareButton.click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                globalThis as unknown as {
                  __copiedListingUrl?: string;
                }
              ).__copiedListingUrl,
          ),
        )
        .toMatch(new RegExp(`/listings/${listingId}$`));
      await expect(
        page.getByText(language.copiedMessage, { exact: true }),
      ).toBeVisible();

      await listingCard.getByTestId(`link-listing-${listingId}`).click();
      await expect(page).toHaveURL(new RegExp(`/listings/${listingId}$`));
      await expect(page.locator("html")).toHaveAttribute(
        "lang",
        language.value,
      );

      const detailShareButton = page.getByTestId(`button-share-${listingId}`);
      await expect(detailShareButton).toBeVisible();
      await expect(detailShareButton).toHaveAttribute(
        "aria-label",
        language.shareLabel,
      );
      await detailShareButton.click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                globalThis as unknown as {
                  __copiedListingUrl?: string;
                }
              ).__copiedListingUrl,
          ),
        )
        .toMatch(new RegExp(`/listings/${listingId}$`));
      await expect(
        page.getByText(language.copiedMessage, { exact: true }),
      ).toBeVisible();
    }
  });
});
