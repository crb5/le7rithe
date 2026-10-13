---
name: Artifact build defaults
description: Routing and port defaults for building the agricultural marketplace artifact.
---

The web artifact must be buildable without manually supplying PORT or BASE_PATH. Workflow and deployment environments may override them, while local production builds use the artifact's registered base path and a non-conflicting Vite port.

**Why:** A build that requires runtime-only environment input cannot be reproduced reliably by CI or release checks, even though the workflow itself supplies those values.

**How to apply:** Keep runtime overrides supported, but provide defaults in the artifact Vite config and verify both an environment-free build and the proxied preview.

For this monorepo, the deployment pre-build must target only the published `agri-market` and `api-server` artifacts; the `mockup-sandbox` is development-only and requires `PORT`/`BASE_PATH` when built directly.

**Why:** The root recursive build includes the design artifact and fails without its workflow-only environment, while the production artifact builds succeed independently.

**How to apply:** Keep `.replit` deployment builds scoped to the services represented by production artifact configurations; do not add the mockup sandbox to the production build gate.