#!/bin/bash
# Applies authentik-blueprints/google-source.yaml: the "Continue with Google"
# social login source. Kept deliberately separate from setup-authentik.sh so
# routine re-runs of that script can never touch or wipe this one's secrets.
#
# Usage:
#   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... ./scripts/setup-google-source.sh
#
# The credentials come from the OAuth 2.0 Client you create in Google Cloud
# Console (APIs & Services > Credentials), with authorized redirect URI
# https://auth.le7rithe.com/source/oauth/callback-google/ (check the exact
# path your Authentik version expects under the source's own settings if this
# doesn't match).
#
# Idempotent — safe to re-run (e.g. after rotating the Google secret).
set -euo pipefail

if [[ -z "${GOOGLE_CLIENT_ID:-}" || -z "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  echo "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first, e.g.:" >&2
  echo "  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... $0" >&2
  exit 1
fi

echo "Applying google-source blueprint..."

docker compose exec -T \
  -e "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" \
  -e "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}" \
  authentik-server ak shell -c "
import os
from authentik.blueprints.models import BlueprintInstance
from authentik.blueprints.v1.tasks import apply_blueprint

context = {
    'google_client_id': os.environ['GOOGLE_CLIENT_ID'],
    'google_client_secret': os.environ['GOOGLE_CLIENT_SECRET'],
}

instance, _ = BlueprintInstance.objects.get_or_create(
    name='le7rithe-google-source',
    path='custom/google-source.yaml',
    defaults={'enabled': True, 'context': context},
)
instance.enabled = True
instance.context = context
instance.save()

apply_blueprint(str(instance.pk))
instance.refresh_from_db()

print(f'status: {instance.status}')
if instance.status != 'successful':
    raise SystemExit(f'Blueprint did not apply successfully: {instance.status}')
"

echo "Done."
