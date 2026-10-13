---
name: Report reply notifications
description: User-facing complaint replies reuse the shared notification table and link back to an ownership-checked report.
---

Complaint replies are persisted on the existing report record and represented in the shared marketplace notification table with a report reference. Each additional reply creates another notification, and report details can use those linked notifications as the reply history. The report and notification APIs must always constrain reads by the authenticated reporter, while admin replies create the notification in the same database transaction as the report update.

**Why:** The marketplace already has durable notifications, and a separate conversation system would duplicate state and make ownership checks easier to miss.

**How to apply:** Keep report replies durable across sessions, use the notification's report reference to open the full response history, mark all linked reply notifications read when the report page opens, and preserve server-side user ownership filters on both notification and report-detail routes.