#!/usr/bin/env bash
# Load secrets from a secure store before exec'ing the target command.
#
# Order of precedence:
#   1. Environment already set                → passthrough (nothing to do)
#   2. macOS Keychain (uranus-openai-key)     → export from Keychain
#   3. Nothing                                → the app degrades gracefully;
#                                               the AdversarySimulator will
#                                               show "OPENAI_API_KEY missing"
#
# The key is never printed, never written to disk, never persisted in shell
# history. The Keychain item is protected by the user account login secret
# and stored in the macOS Data Protection Keychain.

set -eu

if [ -z "${OPENAI_API_KEY:-}" ] && command -v security >/dev/null 2>&1; then
  key=$(security find-generic-password -a "$USER" -s uranus-openai-key -w 2>/dev/null || true)
  if [ -n "$key" ]; then
    export OPENAI_API_KEY="$key"
  fi
  unset key
fi

exec "$@"
