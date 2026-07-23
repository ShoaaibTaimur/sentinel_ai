#!/usr/bin/env bash
set -e

REPO="ShoaaibTaimur/sentinel_ai"
VERSION="1.0.4"

echo "🛡️ Installing Sentinel AI v${VERSION}..."

OS="$(uname -s)"
ARCH="$(uname -m)"

case "${OS}" in
  Linux*)
    if command -v dpkg >/dev/null 2>&1; then
      FILE="sentinel-ai_${VERSION}_amd64.deb"
      URL="https://github.com/${REPO}/releases/download/v${VERSION}/${FILE}"
      echo "Downloading ${FILE}..."
      curl -fsSL -O "${URL}"
      sudo dpkg -i "${FILE}"
      rm "${FILE}"

      # Install Desktop Icon
      ICON_URL="https://raw.githubusercontent.com/${REPO}/main/resources/icon.png"
      sudo curl -fsSL "${ICON_URL}" -o /usr/share/pixmaps/sentinel-ai.png 2>/dev/null || true
      mkdir -p ~/.local/share/icons/hicolor/512x512/apps ~/.local/share/pixmaps
      curl -fsSL "${ICON_URL}" -o ~/.local/share/icons/hicolor/512x512/apps/sentinel-ai.png 2>/dev/null || true
      curl -fsSL "${ICON_URL}" -o ~/.local/share/pixmaps/sentinel-ai.png 2>/dev/null || true
    else
      FILE="sentinel-ai-${VERSION}.AppImage"
      URL="https://github.com/${REPO}/releases/download/v${VERSION}/${FILE}"
      echo "Downloading ${FILE}..."
      curl -fsSL -o sentinel-ai.AppImage "${URL}"
      chmod +x sentinel-ai.AppImage
      mkdir -p ~/.local/bin
      mv sentinel-ai.AppImage ~/.local/bin/sentinel-ai
      echo "Installed app to ~/.local/bin/sentinel-ai"
    fi
    ;;
  Darwin*)
    FILE="Sentinel-AI-${VERSION}.dmg"
    URL="https://github.com/${REPO}/releases/download/v${VERSION}/${FILE}"
    echo "Downloading ${FILE}..."
    if curl -fsSL -O "${URL}"; then
      hdiutil attach "${FILE}"
      cp -R "/Volumes/Sentinel AI/Sentinel AI.app" /Applications/ 2>/dev/null || cp -R "/Volumes/Sentinel-AI/Sentinel-AI.app" /Applications/ 2>/dev/null || cp -R /Volumes/Sentinel*/Sentinel*.app /Applications/
      hdiutil detach "/Volumes/Sentinel AI" 2>/dev/null || hdiutil detach "/Volumes/Sentinel-AI" 2>/dev/null || hdiutil detach /Volumes/Sentinel* 2>/dev/null || true
      rm -f "${FILE}"
    else
      FILE="Sentinel-AI-${VERSION}.zip"
      URL="https://github.com/${REPO}/releases/download/v${VERSION}/${FILE}"
      echo "Downloading ${FILE} fallback..."
      curl -fsSL -O "${URL}"
      unzip -o "${FILE}" -d /Applications/
      rm -f "${FILE}"
    fi
    ;;
  *)
    echo "Unsupported OS: ${OS}"
    exit 1
    ;;
esac

echo "⚡ Installing 'sentinelai' CLI command..."
CLI_URL="https://raw.githubusercontent.com/${REPO}/main/bin/sentinel.js"
if [ -w "/usr/local/bin" ]; then
  curl -fsSL "${CLI_URL}" -o /usr/local/bin/sentinelai
  chmod +x /usr/local/bin/sentinelai
elif command -v sudo >/dev/null 2>&1; then
  sudo curl -fsSL "${CLI_URL}" -o /usr/local/bin/sentinelai
  sudo chmod +x /usr/local/bin/sentinelai
else
  mkdir -p ~/.local/bin
  curl -fsSL "${CLI_URL}" -o ~/.local/bin/sentinelai
  chmod +x ~/.local/bin/sentinelai
fi

echo "✅ Sentinel AI v${VERSION} & 'sentinelai' CLI installed successfully!"
echo "👉 Run 'sentinelai .' in any terminal tab while app is running."
