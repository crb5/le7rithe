#!/bin/bash
# Applies authentik-blueprints/le7rithe-setup.yaml to the running Authentik
# stack: the OAuth2/OIDC provider + application (with the authorization flow
# correctly set to implicit consent from the start) and the username/password
# enrollment flow the app's /sign-up page drives.
#
# Idempotent — safe to re-run any time, including against an
# already-configured server (it updates the same objects, matched by name/
# slug, rather than duplicating them).
#
# Run this from the directory containing docker-compose.yml, after
# `docker compose up -d` and after the Authentik containers have mounted
# ./authentik-blueprints at /blueprints/custom (see docker-compose.yml).
set -euo pipefail

echo "Applying le7rithe-setup blueprint..."

docker compose exec -T authentik-server ak shell -c "
from authentik.blueprints.models import BlueprintInstance
from authentik.blueprints.v1.tasks import apply_blueprint

instance, _ = BlueprintInstance.objects.get_or_create(
    name='le7rithe-setup',
    path='custom/le7rithe-setup.yaml',
    defaults={'enabled': True},
)
if not instance.enabled:
    instance.enabled = True
    instance.save()

apply_blueprint(str(instance.pk))
instance.refresh_from_db()

print(f'status: {instance.status}')
if instance.status != 'successful':
    raise SystemExit(f'Blueprint did not apply successfully: {instance.status}')
"

echo
echo "Done. The OAuth2 provider's Client ID (for OIDC_CLIENT_ID / VITE_OIDC_CLIENT_ID):"
docker compose exec -T authentik-server ak shell -c "
from authentik.providers.oauth2.models import OAuth2Provider
p = OAuth2Provider.objects.get(name='le7rithe')
print(p.client_id)
"
