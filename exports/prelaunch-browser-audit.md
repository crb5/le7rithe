# Le7rithe.com — prelaunch browser audit

**Scope:** Anonymous real-browser pass on the preview deployment. Public marketplace, catalog and legal routes; representative Arabic/French/English UI; desktop (1440×900) and mobile (390×844); marketplace search and filters; signup/sign-in entry paths; anonymous access checks for protected routes.  
**Safety:** No listing, account, permission, database, secret, or workflow changes. No calls, WhatsApp messages, report submissions, listing publication, saves, Google OAuth, or SMS codes were initiated. The only signup input was the synthetic `prelaunch-audit@example.com`, used to verify that the email carries to the next form; registration was not submitted.

## Pre-launch checklist

- [ ] **ما قبل الإطلاق: يتطلب instance إنتاج في Clerk.** Keep the production-build key guard enabled; production builds require a live-mode Clerk publishable key.
- [ ] **اختبار لاحق: إصلاح جلسات E2E في Clerk قبل اختبارات التفويض المحمية.** Current test-state files receive 401 from `/api/account/me`; do not rerun `pnpm setup:e2e-auth` until its Clerk test-user side effects are explicitly intended.
- **Verified in the Replit preview:** requests arrived with three `X-Forwarded-For` entries; a client-supplied `198.51.100.77` marker was removed, and the chain length stayed three with or without one or two spoofed values. `trust proxy = 3` produced three trusted addresses. A permanent regression test covers the three-hop sanitized chain. The probe returned only counts/booleans and did not access an OTP route.
- [ ] **بعد أول نشر إنتاجي:** أعد قياس عمق سلسلة `X-Forwarded-For` وتأكد أن قيمة يرسلها العميل لا تظهر في `req.ip`. قياس المعاينة لا يثبت إعداد مسار الإنتاج.
- **Low — dev-only dependency, absent from production:** `braces` remains under `mockup-sandbox > fast-glob > micromatch`; the sandbox is a design artifact with a development-only service, while `.replit` production builds only `agri-market` and `api-server`.
- [ ] **قاعدة الإنتاج: إنشاء جدول حدود المعدل يدويًا عند الإطلاق فقط.** No migration files are configured. Do not run this SQL against production before the release owner approves the production change:

  ```sql
  CREATE TABLE IF NOT EXISTS marketplace_api_rate_limits (
    limiter_key text NOT NULL,
    client_key_hash text NOT NULL,
    hit_count integer NOT NULL CHECK (hit_count > 0),
    reset_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (limiter_key, client_key_hash)
  );
  CREATE INDEX IF NOT EXISTS marketplace_api_rate_limits_reset_at_idx
    ON marketplace_api_rate_limits (reset_at);
  ```

## Executive summary

**Verdict: prelaunch issues found; authenticated seller workflows remain unverified.** Public home, category browsing, search, location filtering, listing detail, share-to-clipboard, and legal pages render after brief initial hydration. The side drawer works on mobile, and measured mobile document width stayed within the viewport on stable captures.

Do not treat this as an authenticated end-to-end sign-off: the existing dedicated seller storage state did not authenticate and was redirected to sign-in (two 401 resource responses). Consequently, save/unsave, seller edit/delete, seller field rules, and account-specific notifications could not be safely exercised.

### Highest-priority findings

1. **Anonymous Support is gated by sign-in.** `/support` redirects to `/sign-in?redirect_url=%2Fsupport`; no support form or contact instructions are available anonymously. Support was requested as part of the public-route audit, so this is a scope/availability failure unless intentionally account-only.
2. **Unknown and invalid routes lack useful not-found handling.** An unknown path redirected to sign-in instead of a 404. `/listings/999999` left the marketplace shell and a Share button around a blank detail/skeleton region, with no user-facing not-found message; three browser resource 404s were logged.
3. **Catalog data for listing #55 is internally inconsistent / unsuitable for launch.** The machinery listing is titled “جرار” (tractor), but its detail subcategory is Harvester and its Arabic description is an unrelated child-vaccination/COVID passage. The detail says New while the listing card showed Used. Its visual is a stylized machinery placeholder, not a seller photograph. The detail lists 500,000 working hours. Public call and WhatsApp links were present; their number is masked in this report.
4. **Privacy policy contains an unresolved publication-date placeholder:** `[publication date to be set]`.
5. **Transient runtime crash observed during parallel Vite HMR.** At `/listings` in French/mobile, the ErrorBoundary displayed `useIsMutating is not defined`; the browser also logged a React Hooks order change. This coincided with HMR updates to marketplace files while the main implementation was changing. A later revisit stabilized and showed listing #55 with no such runtime error, so this was observed but not reproducible after navigation; investigate before launch rather than treating it as a confirmed persistent crash.

## Updates after the browser audit

The observations above are the initial audit, not the final state. The main implementation subsequently corrected anonymous unknown-route redirects, missing-listing 404 handling, French singular result counts, favorite state/error handling and cache refresh, pagination duplicate-click protection, localized error/loading states, and the first-hour photo/description editing contract and UI.

Final checks confirmed the missing-listing Arabic mobile 404 visually; an anonymous Save click redirected to sign-in without writing a favorite; an unknown route stayed on its own 404 rather than redirecting to sign-in. A read-only mocked pagination response confirmed three immediate clicks requested pages 1 and 2, not page 3, with no uncaught browser errors or mobile horizontal overflow. This pagination check was a UI fixture, not a real multi-page database or authenticated test.

TypeScript checks passed. The configured frontend and API unit suites passed (27 and 9 tests respectively), and a separate listing-field suite passed 5 tests, covering land-only water/electricity display rules. The API suite covers the first-hour boundary, invalid/future timestamps, content writes, and the photo-count limit.

Authenticated seller/admin operations and actual Google/email/phone authentication remain unverified because no valid test session was available for the current external Clerk instance. No account, listing content, publication date, production configuration, or admin rights were changed. The initial HMR error did not recur in the final stable browser checks; development-key and structural-CSS Clerk warnings remain visible and were not suppressed.

## Route and behavior results (initial pass)

| Route / feature | Result | Notes |
|---|---|---|
| `/` | **Pass after hydration** | Arabic initial home rendered; English home was checked at 390×844. One real listing and category counts were present. |
| `/categories` | **Pass after hydration** | Eight category cards rendered. Machinery showed one listing; other categories showed zero. Selecting machinery navigated to its filtered listings URL and returned #55. |
| `/listings` | **Pass after hydration; minor issue** | One real listing appeared after a short wait. Search for the displayed Arabic title returned #55. A no-match query showed a useful zero-results state and “Show all listings”; that recovery restored #55. A separate Rosso location filter retained #55 and updated the URL. No load-more control was available with only one result, so pagination/load-more could not be meaningfully exercised. |
| Filter panel | **Pass, representative controls** | Mobile panel expands inline and exposes category, disabled subcategory, location and condition controls. Rosso selection worked. Other categories, conditions and sort choices were not exhaustively exercised. |
| `/listings/55` | **Pass after hydration; catalog/content defects** | Detail rendered with save, report and share controls, seller information, detail fields and a stylized tractor illustration. Share displayed an Arabic “link copied” toast. Contact anchors use `tel:` and `wa.me`; neither was activated. Save/report were not submitted. |
| `/listings/999999` | **Fail** | No explicit 404/not-found state. After the loading message disappeared, the page retained an empty detail region and Share control; three resource 404 errors were logged. |
| `/support` | **Fail / inaccessible anonymously** | Redirected to `/sign-in?redirect_url=%2Fsupport`; no support form was available. |
| `/privacy` | **Pass with content issue** | English privacy page rendered with 14 section links; last-updated date is still `[publication date to be set]`. |
| `/terms` | **Pass** | English terms page rendered with four sections and footer/legal navigation. |
| `/add-listing` | **Pass as anonymous gate** | Renders an account-required prompt with sign-in, signup, and back-to-market links. No form or draft was created. |
| `/saved` | **Pass as auth gate** | Redirected to `/sign-in?redirect_url=%2Fsaved`. |
| `/dashboard` | **Pass as auth gate** | Redirected to `/sign-in?redirect_url=%2Fdashboard`. |
| `/dashboard/active-listings` | **Pass as auth gate after hydration** | Initially blank, then redirected to sign-in with the return path preserved. |
| `/account` | **Pass as auth gate** | Redirected to sign-in with `/account` preserved. |
| `/notifications` | **Pass as auth gate** | Redirected to sign-in with `/notifications` preserved. |
| `/reports/55` | **Pass as auth gate** | Redirected to sign-in with `/reports/55` preserved. |
| Unknown route | **Fail** | `/this-route-should-not-exist` redirected to sign-in instead of rendering a 404. |

## Localization and responsive observations

- **AR:** Initial homepage and listing detail rendered Arabic UI.
- **FR:** Listing and detail interface labels changed to French and document direction to LTR. Listing-authored title, seller name, and description remained Arabic (catalog content, not interface labels). The counter for one item displayed **“1 annonces disponibles”**, a French singular/plural grammar defect. Clerk’s “Secured by” / “Development mode” labels remain English.
- **EN:** Homepage, categories, listing search/results, empty state, filters, and legal content rendered English interface labels.
- Stable mobile captures at **390×844** reported document/body widths of **375px** or, on a later capture, 390px—no horizontal overflow beyond the viewport. Listing detail stacks vertically. Category cards use two columns and the Agricultural machinery label truncates with an ellipsis. Filter panel stacks vertically and scrolls. Desktop home/categories/detail were checked at **1440×900** without observed horizontal overflow.
- Page navigation often produced a short generic loading state or a blank screenshot on the first capture. Bounded waits showed that several routes (home, categories, privacy, listing detail, auth) then rendered. Treat first-frame blanks as a hydration/paint concern, not proof of a persistent blank page.

## Authentication and seller-flow limitations

- Sign-in UI exposed Google, phone, and email/password options. Phone entry opened a French form with a Mauritania `+222` prefix and a send-code button; no number was entered and no SMS was requested. Google OAuth was not launched.
- Email signup preserved the synthetic address through “Continue” to the required name/password/consent form. Continue was disabled in the accessibility snapshot until required fields/consent are completed (the screenshot looked visually enabled); the final registration action was not submitted because that could create an account. No signup request/result or submit-handler error state was tested.
- Reused only the existing dedicated seller storage-state file in an isolated context, without printing its contents. It redirected to sign-in and logged two 401 resource failures, so it was not valid for this Clerk instance. The isolated context was closed; no sign-out or account changes occurred.
- Since there was no valid test identity or explicitly marked tester-owned listing, **save/unsave, seller listing edit/delete, seller field rules (price/phone/WhatsApp always editable; description/photos only during first hour; water/electricity only for agricultural land), and authenticated reports/support were not exercised**. No real listing was edited or deleted.

## Browser/runtime notes

- Clerk loaded in **development mode** and emitted its development-key warning plus a structural-CSS warning for selectors coupled to Clerk internals. Password inputs also emitted a missing `autocomplete` suggestion.
- The transient HMR-time listings error and hook-order warning are described above. A later stable listing revisit rendered one card; the HMR error did not recur in that revisit.
- Invalid detail produced three generic resource 404 errors. No cookie values, authorization tokens, storage-state content, network HAR, or trace was included in this report.

## Screenshot evidence

The browser test harness captured visual evidence and the following screenshot IDs are attached to the audit response:

- `c7s2a6` — English mobile homepage and narrow category cards.
- `rvn5u8` — open mobile navigation drawer.
- `bhpa68` — category catalog.
- `85s17l` — category-filtered listing results.
- `jqn4s7` — mobile no-results state and recovery action.
- `djl7yp` — French mobile detail with placeholder tractor visual and description.
- `z57fhs` — invalid listing detail with blank content area.
- `7otmf7` — transient listings ErrorBoundary during HMR (`useIsMutating is not defined`).
- `21v68b` — phone sign-in entry form; no number or code entered.

The browser interface exposes these captures as response attachments/IDs rather than screenshot file bytes; therefore this report indexes the captured evidence but does not claim separate local image files were written. No authentication or network secrets are present in the attached screenshots selected for the response.
