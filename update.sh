#!/bin/bash
set -u

# Go to the project root directory
cd "$(dirname "$0")"
PROJECT_ROOT="$(pwd)"
LOG_FILE="$PROJECT_ROOT/update.log"

log() {
  echo "$1" >> "$LOG_FILE"
}

run_step() {
  local description="$1"
  shift
  log "$description"
  "$@" >> "$LOG_FILE" 2>&1
  local status=$?
  if [ "$status" -ne 0 ]; then
    log "ERROR: Step failed with exit code ${status}: $description"
    log "=== System Update Failed: $(date) ==="
    exit "$status"
  fi
}

echo "=== System Update Started: $(date) ===" > "$LOG_FILE"

run_step "0. Checking GitHub access..." git ls-remote --exit-code origin main
run_step "1. Pulling latest code from GitHub..." git pull --ff-only origin main

cd "$PROJECT_ROOT/backend"
run_step "2. Installing backend dependencies..." npm install
run_step "3. Generating Prisma client..." npx prisma generate
run_step "4. Building backend..." npm run build
run_step "5. Applying database migrations..." npx prisma migrate deploy

cd "$PROJECT_ROOT/frontend"
run_step "6. Installing frontend dependencies..." npm install
run_step "7. Building frontend..." npm run build

log "8. Restarting application via PM2..."
run_step "8. Restarting 9drive-backend..." pm2 restart 9drive-backend --update-env
echo "=== System Update Completed: $(date) ===" >> "$LOG_FILE"
