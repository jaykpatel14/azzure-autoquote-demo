#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AWS_REGION="${AWS_REGION:-us-east-2}"
ECR_REPOSITORY="${ECR_REPOSITORY:-azzure-autoquote}"
CONTAINER_NAME="${CONTAINER_NAME:-azzure-autoquote}"
APP_PORT="${APP_PORT:-8585}"
ENV_FILE="${APP_DIR}/.env"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/api/health"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# A commit SHA can be supplied by GitHub Actions.
IMAGE_TAG="${1:-latest}"
IMAGE_URI="${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"

echo "Deploying ${IMAGE_URI}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Environment file not found: ${ENV_FILE}"
  exit 1
fi

aws ecr get-login-password --region "${AWS_REGION}" | docker login \
  --username AWS \
  --password-stdin "${ECR_REGISTRY}"

docker pull "${IMAGE_URI}"

echo "Running Prisma migrations..."

docker run --rm \
  --entrypoint /app/node_modules/.bin/prisma \
  --env-file "${ENV_FILE}" \
  "${IMAGE_URI}" \
  migrate deploy \
  --schema=/app/prisma/schema.prisma

# Preserve the current container temporarily for rollback.
if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  docker rm -f "${CONTAINER_NAME}-previous" 2>/dev/null || true
  docker rename "${CONTAINER_NAME}" "${CONTAINER_NAME}-previous"
fi

docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --env-file "${ENV_FILE}" \
  -p "${APP_PORT}:${APP_PORT}" \
  "${IMAGE_URI}"

echo "Waiting for the application to become healthy..."
HEALTHY=false
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error "${HEALTH_URL}" >/dev/null; then
    HEALTHY=true
    break
  fi
  echo "Health check attempt ${attempt}/30 failed."
  sleep 5
done

if [[ "${HEALTHY}" != "true" ]]; then
  echo "New container failed its health check."
  docker logs --tail 200 "${CONTAINER_NAME}" || true
  docker rm -f "${CONTAINER_NAME}" || true

  if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}-previous"; then
    echo "Restoring the previous container."
    docker rename "${CONTAINER_NAME}-previous" "${CONTAINER_NAME}"
    docker start "${CONTAINER_NAME}"
  fi

  exit 1
fi

docker rm -f "${CONTAINER_NAME}-previous" 2>/dev/null || true

# Remove unused images without affecting running containers.
docker image prune -f

echo "Deployment completed successfully."
docker ps --filter "name=${CONTAINER_NAME}"
