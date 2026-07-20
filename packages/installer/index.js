#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { execSync, spawn } = require('child_process');
const https = require('https');

// Design Tokens: Console Colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  accent: '\x1b[35m'
};

const BANNER = `
${C.accent}${C.bold}  🛡️  SENTINEL AI  ${C.reset}${C.dim}— Desktop Assistant Installer${C.reset}
  ──────────────────────────────────────────
`;

console.log(BANNER);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// OpenCode Zen Configuration
const BASE_URL = 'https://opencode.ai/zen/v1';
const STORE_KEY = 'sentinel-ai-v1-secure';
const STORE_ALGO = 'aes-256-cbc';

// Config store encryption helper
function encryptStore(dataObj) {
  const jsonStr = JSON.stringify(dataObj, null, '\t');
  const iv = crypto.randomBytes(16);
  const password = crypto.pbkdf2Sync(STORE_KEY, iv.toString(), 10000, 32, 'sha512');
  const cipher = crypto.createCipheriv(STORE_ALGO, password, iv);
  return Buffer.concat([iv, Buffer.from(':'), cipher.update(Buffer.from(jsonStr)), cipher.final()]);
}

function decryptStore(buf) {
  try {
    if (buf.slice(16, 17).toString() !== ':') {
      return JSON.parse(buf.toString());
    }
    const iv = buf.slice(0, 16);
    const password = crypto.pbkdf2Sync(STORE_KEY, iv.toString(), 10000, 32, 'sha512');
    const decipher = crypto.createDecipheriv(STORE_ALGO, password, iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(buf.slice(17))), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

// Validate API Key using OpenCode Zen
function validateApiKey(key) {
  return new Promise((resolve) => {
    const req = https.get(`${BASE_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${key}`
      }
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function main() {
  const isMac = process.platform === 'darwin';
  const isLinux = process.platform === 'linux';

  if (!isMac && !isLinux) {
    console.error(`${C.red}Error: Unsupported platform ${process.platform}. Only macOS and Linux are supported.${C.reset}`);
    process.exit(1);
  }

  console.log(`${C.cyan}Step 1: System Detection${C.reset}`);
  console.log(`  OS: ${C.bold}${isMac ? 'macOS' : 'Linux'}${C.reset}`);
  console.log(`  Arch: ${C.bold}${process.arch}${C.reset}`);

  // API Key setup
  console.log(`\n${C.cyan}Step 2: API Key Configuration${C.reset}`);
  let apiKey = '';
  let valid = false;

  while (!valid) {
    apiKey = await question(`${C.bold}Enter your OpenCode Zen API Key (from opencode.ai/auth): ${C.reset}`);
    apiKey = apiKey.trim();

    if (!apiKey) {
      console.log(`${C.yellow}API key cannot be empty.${C.reset}`);
      continue;
    }

    console.log(`${C.dim}Validating key...${C.reset}`);
    valid = await validateApiKey(apiKey);

    if (!valid) {
      console.log(`${C.red}Invalid API Key. Please verify at opencode.ai/auth.${C.reset}`);
    }
  }
  console.log(`${C.green}✓ API Key validated successfully!${C.reset}`);

  // Save to config
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const configDir = isMac
    ? path.join(homeDir, 'Library', 'Application Support', 'sentinel-ai')
    : path.join(homeDir, '.config', 'sentinel-ai');
  const configPath = path.join(configDir, 'sentinel-ai.json');

  let storeData = {};
  if (fs.existsSync(configPath)) {
    try {
      storeData = decryptStore(fs.readFileSync(configPath));
    } catch {
      // Ignore
    }
  }

  storeData.apiKey = apiKey;
  storeData.provider = 'opencode-zen';
  if (!storeData.model) storeData.model = 'gpt-4o';
  if (!storeData.alwaysAllow) storeData.alwaysAllow = [];

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, encryptStore(storeData));
  console.log(`${C.green}✓ Secure configuration saved.${C.reset}`);

  // Find install source
  console.log(`\n${C.cyan}Step 3: Installation & Build${C.reset}`);
  let installDir = '';

  // Check if we are running in the checkout of sentinel-ai
  const potentialLocalRoot = path.resolve(__dirname, '..', '..');
  const hasLocalPkg = fs.existsSync(path.join(potentialLocalRoot, 'package.json'));
  const pkgData = hasLocalPkg ? require(path.join(potentialLocalRoot, 'package.json')) : {};

  if (pkgData.name === 'sentinel-ai') {
    installDir = potentialLocalRoot;
    console.log(`  Source: ${C.bold}Local Checkout (${installDir})${C.reset}`);
  } else {
    // npx mode: clone the repository to ~/.sentinel-ai
    installDir = path.join(homeDir, '.sentinel-ai');
    console.log(`  Source: ${C.bold}npx mode, installing to ${installDir}${C.reset}`);

    if (fs.existsSync(installDir)) {
      console.log(`  ${C.yellow}Directory already exists. Updating...${C.reset}`);
      execSync('git pull', { cwd: installDir, stdio: 'inherit' });
    } else {
      console.log(`  ${C.dim}Cloning repository...${C.reset}`);
      execSync(`git clone https://github.com/shoaib-sentinel/sentinel-ai.git "${installDir}"`, { stdio: 'inherit' });
    }
  }

  // Build the app
  console.log(`  ${C.dim}Installing dependencies and building app...${C.reset}`);
  execSync('npm install', { cwd: installDir, stdio: 'inherit' });
  execSync('npm run build', { cwd: installDir, stdio: 'inherit' });
  console.log(`${C.green}✓ Sentinel AI built successfully.${C.reset}`);

  // Autostart configuration
  console.log(`\n${C.cyan}Step 4: Startup Services${C.reset}`);

  if (isLinux) {
    // 1. Create Autostart .desktop entry
    const autostartDir = path.join(homeDir, '.config', 'autostart');
    const desktopPath = path.join(autostartDir, 'sentinel-ai.desktop');
    const execPath = path.join(installDir, 'node_modules', '.bin', 'electron');
    const appEntry = path.join(installDir, '.');
    const iconPath = path.join(installDir, 'resources', 'icon.svg');

    const desktopContent = `[Desktop Entry]
Type=Application
Name=Sentinel AI
Comment=System-wide AI assistant
Exec=${execPath} ${appEntry} --no-sandbox
Icon=${iconPath}
Terminal=false
Categories=Utility;
X-GNOME-Autostart-enabled=true
`;
    fs.mkdirSync(autostartDir, { recursive: true });
    fs.writeFileSync(desktopPath, desktopContent);
    console.log(`${C.green}✓ Created Desktop Autostart entry: ${desktopPath}${C.reset}`);

    // 2. Create Systemd User service for background runner option
    const systemdDir = path.join(homeDir, '.config', 'systemd', 'user');
    const servicePath = path.join(systemdDir, 'sentinel-ai.service');
    const serviceContent = `[Unit]
Description=Sentinel AI Assistant Daemon
After=graphical-session.target

[Service]
ExecStart=${execPath} ${appEntry} --no-sandbox
Restart=on-failure
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
`;
    fs.mkdirSync(systemdDir, { recursive: true });
    fs.writeFileSync(servicePath, serviceContent);
    console.log(`${C.green}✓ Created Systemd User Service: ${servicePath}${C.reset}`);
    console.log(`  To enable: ${C.bold}systemctl --user enable sentinel-ai${C.reset}`);
  }

  if (isMac) {
    // Create LaunchAgent plist
    const launchAgentsDir = path.join(homeDir, 'Library', 'LaunchAgents');
    const plistPath = path.join(launchAgentsDir, 'com.sentinel.assistant.plist');
    const execPath = path.join(installDir, 'node_modules', '.bin', 'electron');
    const appEntry = path.join(installDir, '.');

    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.sentinel.assistant</string>
    <key>ProgramArguments</key>
    <array>
        <string>${execPath}</string>
        <string>${appEntry}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
`;
    fs.mkdirSync(launchAgentsDir, { recursive: true });
    fs.writeFileSync(plistPath, plistContent);
    console.log(`${C.green}✓ Created LaunchAgent: ${plistPath}${C.reset}`);
    console.log(`  To load: ${C.bold}launchctl load ${plistPath}${C.reset}`);
  }

  console.log(`\n${C.green}${C.bold}🎉 INSTALLATION COMPLETE!${C.reset}`);
  console.log(`  Sentinel AI is now configured and ready to protect your workspace.`);
  console.log(`  Press ${C.bold}Super+Space${C.reset} (Command+Space on Mac) to toggle Sentinel system-wide.`);
  console.log(`  To run now: ${C.bold}npm start${C.reset} (in ${installDir})\n`);

  rl.close();
}

main().catch(err => {
  console.error(`${C.red}Installation failed: ${err.message || String(err)}${C.reset}`);
  rl.close();
  process.exit(1);
});
