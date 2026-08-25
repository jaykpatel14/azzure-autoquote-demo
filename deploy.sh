#!/usr/bin/env bash

set -Eeuo pipefail

AWS_REGION="${AWS_REGION:-us-east-2}"
ECR_REPOSITORY="${ECR_REPOSITORY:-azzure-autoquote}"
CONTAINER_NAME="${CONTAINER_NAME:-azzure-autoquote}"
APP_PORT="${APP_PORT:-8585}"
ENV_FILE="/opt/azzure-autoquote/.env"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"

AWS_ACCOUNT_ID="$(
  aws sts get-caller-identity \
    --query Account \
    --output text
)"

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

IMAGE_TAG="${1:-latest}"

APP_IMAGE="${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"

echo "Application image: ${APP_IMAGE}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Environment file not found: ${ENV_FILE}"
  exit 1
fi

aws ecr get-login-password --region "${AWS_REGION}" |
  docker login \
    --username AWS \
    --password-stdin "${ECR_REGISTRY}"

echo "Pruning Docker objects to free up disk space..."

# Clean up unused images, containers, networks, and volumes
docker system prune -af --volumes 2>/dev/null || true

# Also remove dangling images specifically
docker image prune -af --filter "until=1h" 2>/dev/null || true

echo "Disk space available after pruning:"
df -h / 2>/dev/null || true

echo "Pulling application image..."
docker pull "${APP_IMAGE}"

echo "Running Prisma migrations..."

docker run --rm \
  --env-file "${ENV_FILE}" \
  "${APP_IMAGE}" \
  ./node_modules/.bin/prisma migrate deploy --schema=/app/prisma/schema.prisma

echo "Validating migration status..."

if ! docker run --rm \
  --env-file "${ENV_FILE}" \
  "${APP_IMAGE}" \
  ./node_modules/.bin/prisma migrate status --schema=/app/prisma/schema.prisma; then
  echo "ERROR: Prisma schema drift detected. Database migrations and schema are not in sync."
  echo "Please generate a migration locally (npx prisma migrate dev) and push."
  exit 1
fi

echo "Migrations completed."

if docker ps -a --format '{{.Names}}' |
  grep -qx "${CONTAINER_NAME}"; then

  docker rm -f "${CONTAINER_NAME}-previous" 2>/dev/null || true
  docker rename "${CONTAINER_NAME}" "${CONTAINER_NAME}-previous"
fi

echo "Starting application container..."

docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --env-file "${ENV_FILE}" \
  -e APP_HOST=0.0.0.0 \
  -e PORT="${APP_PORT}" \
  -p "${APP_PORT}:${APP_PORT}" \
  "${APP_IMAGE}"

echo "Running container image:"
docker inspect --format '{{.Config.Image}}' "${CONTAINER_NAME}"

echo "Waiting for application health check..."

HEALTHY=false

for attempt in $(seq 1 30); do
  if curl \
    --fail \
    --silent \
    --show-error \
    "${HEALTH_URL}" >/dev/null; then

    HEALTHY=true
    break
  fi

  echo "Health check ${attempt}/30 failed."
  sleep 5
done

if [[ "${HEALTHY}" != "true" ]]; then
  echo "New application container failed health check."

  docker logs --tail 200 "${CONTAINER_NAME}" || true
  docker rm -f "${CONTAINER_NAME}" || true

  if docker ps -a --format '{{.Names}}' |
    grep -qx "${CONTAINER_NAME}-previous"; then

    echo "Restoring previous application container."

    docker rename \
      "${CONTAINER_NAME}-previous" \
      "${CONTAINER_NAME}"

    docker start "${CONTAINER_NAME}"
  fi

  exit 1
fi

docker rm -f "${CONTAINER_NAME}-previous" 2>/dev/null || true
docker image prune -f

echo "Deployment completed successfully."

docker ps --filter "name=${CONTAINER_NAME}"
