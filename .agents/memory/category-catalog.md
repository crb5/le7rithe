---
name: Marketplace category catalog
description: Durable design choice for extensible marketplace categories and listing-specific fields.
---

Marketplace categories and subcategories are database records with Arabic, French, and English names, ordering, and active state. Listing-specific fields are stored in a JSON attributes object while common searchable fields remain typed columns.

**Why:** The marketplace needs new categories and custom field sets without a schema migration or frontend-only hardcoded catalog for every future category.

**How to apply:** Keep catalog administration in the API and use the category slug to select the dynamic field configuration. Treat the database category/subcategory records as the source of truth for labels and availability.