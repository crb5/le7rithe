# Le7rithe.com | السوق الزراعي الموريتاني

Le7rithe.com منصة زراعية موريتانية لبيع وشراء وتأجير كل ما يتعلق بالزراعة.

## Run & Operate

- `yarn workspace @workspace/api-server run dev` — run the API server (port 5000)
- `yarn typecheck` — full typecheck across all packages
- `yarn test:e2e:private-payment-review` — run the release receipt gate against a provisioned private bucket
- `yarn test:private-object-storage-cleanup` — verify stale private receipt cleanup against a provisioned bucket
- `yarn validate:development-schema` — verify the development notification schema before report/payment browser suites
- `yarn build` — typecheck + build all packages
- `yarn workspace @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `yarn workspace @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- Yarn 4 (Modern) workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/agri-market/src/pages/marketplace.tsx` — صفحات السوق والاكتشاف والتفاصيل والحساب.
- `artifacts/agri-market/src/components/marketplace-ui.tsx` — الغلاف المشترك وبطاقات الإعلانات.
- `lib/api-spec/openapi.yaml` — العقد المصدر للـ API والـ hooks المولدة.
- `artifacts/api-server/src/routes/marketplace.ts` — نقاط API للإعلانات والمفضلة والرسائل والملخص.
- `lib/db/src/schema/marketplace.ts` — جداول المستخدمين والفئات والإعلانات والمحفوظات والرسائل.
- `artifacts/agri-market/src/pages/category-pages.tsx` — صفحة كتالوج الفئات وإدارة الفئات والفئات الفرعية.
- `artifacts/agri-market/src/lib/category-catalog.ts` — تعريف الحقول الديناميكية الخاصة بكل فئة.
- `artifacts/agri-market/src/lib/language.tsx` — تبديل اللغة واتجاه الصفحة.
- `artifacts/agri-market/src/index.css` — نظام الألوان والخطوط واتجاه RTL.

## Architecture decisions

- الواجهة React/Vite مع Wouter لأن التطبيق يحتاج صفحات عامة متعددة قابلة للنشر من مسار واحد.
- عقد OpenAPI هو المصدر الواحد للـ API؛ يتم توليد React Query hooks وZod schemas منه.
- الفئات والفئات الفرعية مخزنة في PostgreSQL، بينما تحفظ الحقول الخاصة بكل إعلان في `attributes` مرن حتى يمكن توسيع الحقول دون تغيير مخطط الجدول لكل فئة.
- PostgreSQL/Drizzle يحفظ بيانات السوق، مع بيانات تجريبية صغيرة تُنشأ عند أول طلب إذا كانت قاعدة البيانات فارغة.
- Clerk هو نظام المصادقة، وتبقى الصفحة الرئيسية عامة بينما صفحات تسجيل الدخول مخصصة بصريًا للعربية.

## Product

- اكتشاف الإعلانات الزراعية والبحث بالفئة والموقع والحالة والترتيب.
- تفاصيل الإعلان مع حفظ الإعلان والتواصل مع البائع.
- إضافة الإعلانات، إدارة إعلانات البائع، الرسائل، والمحفوظات.
- ملخص لوحة البائع ومؤشرات السوق.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- بعد تعديل `lib/api-spec/openapi.yaml` يجب تشغيل codegen قبل فحص أو استخدام hooks الواجهة.
- قيم PostgreSQL الرقمية تُحوّل إلى أرقام قبل تمريرها إلى Zod response schemas.
- يجب تشغيل `yarn workspace @workspace/api-spec run codegen` بعد أي تعديل في عقد الفئات أو الإعلانات.

## Pointers

- Yarn 4 (Modern) workspaces with `nodeLinker: node-modules` (see `.yarnrc.yml`); run commands with `yarn workspace <name> run <script>` or the root scripts above
