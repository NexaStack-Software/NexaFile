#!/bin/sh

# 🚀 Starting NexaSign...
printf "🚀 Starting NexaSign...\n\n"

# 🔐 Check signature certificate
printf "🔐 Checking signature certificate...\n"

CERT_PATH="${NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH:-/opt/nexasign/cert.p12}"

if [ -f "$CERT_PATH" ] && [ -r "$CERT_PATH" ]; then
    printf "✅ Certificate found and readable — document signing is ready.\n"
else
    printf "⚠️  Certificate not found or not readable at %s\n" "$CERT_PATH"
    printf "   NexaSign will start, but signed documents will stay on status \"Ausstehend\"\n"
    printf "   because the seal job cannot produce a signed PDF.\n"
    printf "   Fix for dev/test:  ./scripts/nexasign/generate-dev-cert.sh  (from repo root)\n"
    printf "   Fix for production: buy an AATL cert — see SIGNING.nexasign.md\n"
fi

printf "\n📚 Useful Links:\n"
printf "📖 NexaSign README:          README.nexasign.md (repo root)\n"
printf "🔐 Certificate setup:        SIGNING.nexasign.md\n"
printf "📋 Changelog vs. Upstream:   CHANGELOG.nexasign.md\n"
printf "🐳 Upstream NexaSign docs:  https://docs.nexasign.com (for core app behaviour)\n\n"

printf "🗄️  Running database migrations...\n"
npx prisma migrate deploy --schema ../../packages/prisma/schema.prisma

printf "🌟 Starting NexaSign server...\n"
HOSTNAME=0.0.0.0 node build/server/main.js
