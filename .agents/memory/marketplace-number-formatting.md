---
name: Marketplace number formatting
description: Display rules for marketplace numbers, prices, and currency labels.
---

All user-visible numeric values use Western digits with French/Mauritanian grouping, and money values append the explicit ISO currency code rather than relying on localized currency names. Mauritanian currency is always displayed as `MRU`.

New listing submissions and listing edits write MRU only, regardless of a submitted currency value. Do not bulk-convert existing records; legacy listings continue to display their stored currency until an explicit edit saves them.

**Why:** The marketplace now constrains every new write to MRU, but existing rows must not be mass-updated and their prices must remain understandable through their saved currency code.

**How to apply:** Use the shared language number and money formatters for counts, prices, amounts, revenue, badges, and dialogs. Keep generic legacy currency support in storage and display paths, but do not offer non-MRU choices in write forms or schemas. Do not add direct `Intl.NumberFormat(..., { style: "currency" })` calls or translated Ouguiya labels in page components.