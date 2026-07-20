#!/usr/bin/env bash
# Sentinel AI — quick dev launcher
set -e
cd "$(dirname "$0")"
echo "🛡️  Starting Sentinel AI in dev mode..."
echo "   Hotkey: Super+Space (or Alt+Space fallback)"
echo "   Close window: Esc or click ✕"
npm run dev
