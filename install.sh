#!/usr/bin/env bash
set -e

# Design colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0;0m' # No Color

echo -e "${BLUE}🛡️ Installing Sentinel AI...${NC}"

OS="$(uname -s)"
ARCH="$(uname -m)"

REPO="ShoaaibTaimur/sentinel_ai"
LATEST_RELEASE_URL="https://api.github.com/repos/${REPO}/releases/latest"

# Get latest tag name
TAG=$(curl -s "$LATEST_RELEASE_URL" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$TAG" ]; then
    echo -e "${RED}Error: Could not retrieve latest release info from GitHub.${NC}"
    exit 1
fi

echo -e "${GREEN}Found release: ${TAG}${NC}"
VERSION="${TAG#v}"

if [ "$OS" = "Darwin" ]; then
    echo -e "${BLUE}OS: macOS (${ARCH})${NC}"
    INSTALL_DIR="/Applications"
    
    if [ "$ARCH" = "x86_64" ]; then
        ARCH_NAME="x64"
    else
        ARCH_NAME="arm64"
    fi
    DOWNLOAD_URL="https://github.com/ShoaaibTaimur/sentinel_ai/releases/download/${TAG}/Sentinel-AI-${VERSION}-${ARCH_NAME}-mac.zip"
    
    echo -e "Downloading: ${DOWNLOAD_URL}"
    curl -L "$DOWNLOAD_URL" -o /tmp/sentinel-ai-mac.zip
    
    echo -e "Extracting to ${INSTALL_DIR}..."
    unzip -q -o /tmp/sentinel-ai-mac.zip -d "$INSTALL_DIR"
    rm /tmp/sentinel-ai-mac.zip
    
    echo -e "${GREEN}✓ Sentinel AI installed in /Applications successfully!${NC}"
    echo -e "You can now search and launch 'Sentinel AI' from Spotlight or Launchpad."

elif [ "$OS" = "Linux" ]; then
    echo -e "${BLUE}OS: Linux (${ARCH})${NC}"
    INSTALL_DIR="${HOME}/.local/share/sentinel-ai"
    mkdir -p "$INSTALL_DIR"
    
    DOWNLOAD_URL="https://github.com/ShoaaibTaimur/sentinel_ai/releases/download/${TAG}/Sentinel-AI-${VERSION}.AppImage"
    ICON_URL="https://raw.githubusercontent.com/ShoaaibTaimur/sentinel_ai/main/resources/icon.png"
    
    echo -e "Downloading AppImage: ${DOWNLOAD_URL}"
    curl -L "$DOWNLOAD_URL" -o "$INSTALL_DIR/sentinel-ai.AppImage"
    chmod +x "$INSTALL_DIR/sentinel-ai.AppImage"
    
    echo -e "Downloading Icon: ${ICON_URL}"
    curl -L "$ICON_URL" -o "$INSTALL_DIR/icon.png"
    
    # Create desktop entry
    DESKTOP_DIR="${HOME}/.local/share/applications"
    mkdir -p "$DESKTOP_DIR"
    
    cat <<EOF > "$DESKTOP_DIR/sentinel-ai.desktop"
[Desktop Entry]
Type=Application
Name=Sentinel AI
Comment=System-wide AI assistant
Exec=${INSTALL_DIR}/sentinel-ai.AppImage --no-sandbox
Icon=${INSTALL_DIR}/icon.png
Terminal=false
Categories=Utility;
X-GNOME-Autostart-enabled=true
EOF
    
    chmod +x "$DESKTOP_DIR/sentinel-ai.desktop"
    echo -e "${GREEN}✓ Sentinel AI installed in ${INSTALL_DIR} and desktop entry registered!${NC}"
    echo -e "You can now search and launch 'Sentinel AI' from your desktop application launcher."

else
    echo -e "${RED}Unsupported OS: ${OS}${NC}"
    exit 1
fi
