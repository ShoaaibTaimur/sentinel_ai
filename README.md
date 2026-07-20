# 🛡️ Sentinel AI

**A keyboard-first, system-wide AI assistant for your desktop.**

Sentinel AI is not a browser extension or a chatbot widget — it's a true operating system assistant that integrates with your files, terminal, git, browser, and running apps. Launch it with a hotkey, tell it what you want, and it plans, confirms, and executes.

> ⚠️ **Status:** In active development. Core UI and AI integration complete. Plugins, conversation history, and installer are in progress.

---

## ✨ Features

- **⌨️ Keyboard-First** — Every action is accessible via keyboard. Mouse is never required.
- **🧠 Context-Aware** — Detects your active window, app, URL, and project automatically.
- **🔒 Permission Engine** — Every sensitive action shows a plan, command, reason, and risk level before execution. You approve or cancel.
- **⚡ Global Hotkey** — Launch instantly with `Super+Space`.
- **🔌 Plugin Architecture** — Modular plugins for filesystem, terminal, git, and application management.
- **🎨 Premium UI** — Dark theme, smooth animations, minimal interface inspired by Raycast, Warp, and Arc Browser.
- **🤖 AI-Powered** — Integrates with [OpenCode Zen](https://opencode.ai) for intelligent task planning and execution.
- **💬 Natural Language** — Type commands like "Switch to Claude", "Rename every PDF in this folder", or "Commit and push my changes".

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/ShoaaibTaimur/sentinel_ai.git
cd sentinel_ai

# Install dependencies
npm install

# Start in dev mode
npm run dev
```

Or use the convenience script:

```bash
chmod +x start.sh
./start.sh
```

---

## 🛠️ Tech Stack

| Layer              | Technology                                  |
| ------------------ | ------------------------------------------- |
| Framework          | [Electron](https://www.electronjs.org/) + [React](https://react.dev/) + [Vite](https://vitejs.dev/) |
| Language           | TypeScript                                  |
| Styling            | Vanilla CSS + CSS Variables                 |
| AI Provider        | [OpenCode Zen](https://opencode.ai) (OpenAI-compatible API) |
| Storage            | [electron-store](https://github.com/sindresorhus/electron-store) |
| Context Detection  | [active-win](https://github.com/sindresorhus/active-win) |
| Git Integration    | [simple-git](https://github.com/steveukx/git-js) |
| Browser Automation | Playwright (planned)                        |

---

## 📁 Project Structure

```
sentinel-ai/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # App entry & window management
│   │   ├── hotkey.ts         # Super+Space global shortcut
│   │   ├── ipc/              # IPC handlers (AI, permissions, context, commands)
│   │   ├── providers/        # AI provider integrations
│   │   │   └── opencode-zen.ts
│   │   ├── plugins/          # Filesystem, terminal, git, applications
│   │   └── store.ts          # Persistent settings via electron-store
│   ├── renderer/             # React UI
│   │   ├── components/       # TopBar, Sidebar, ModelSwitcher, PermissionDialog, etc.
│   │   ├── pages/            # Chat, Tasks, History, Plugins, Settings, About
│   │   ├── hooks/            # useKeyboard, useAI, useContext
│   │   └── styles/           # globals.css (tokens), components.css
│   └── preload/              # Electron preload scripts
├── packages/
│   └── installer/            # npx @sentinel-ai/install (planned)
├── assets/
│   └── logo.svg
└── package.json
```

---

## 🎮 UI Layout

```
┌──────────────────────────────────────────────┐
│  Sentinel AI         Zen ● Connected   GPT-5.5│
├──────────────────────────────────────────────┤
│                                              │
│   Chat history + prompt input                │
│                                              │
├──────────────────────────────────────────────┤
│  ↑↓ Navigate   Enter Select   Tab Menu       │
│  Esc Back      Ctrl+K Search  Ctrl+M Models  │
└──────────────────────────────────────────────┘
```

**Sidebar** (toggled with `Tab`):
`Chat` · `Tasks` · `History` · `Plugins` · `Settings` · `About` · `Exit`

---

## ⌨️ Built-in Commands

| Command    | Description                         |
| ---------- | ----------------------------------- |
| `help`     | Show available commands             |
| `models`   | Switch AI models                    |
| `provider` | Manage AI provider settings         |
| `apikey`   | Update your API key                 |
| `plugins`  | View and manage plugins             |
| `settings` | Open settings panel                 |
| `history`  | Browse conversation history         |
| `clear`    | Clear current chat                  |
| `about`    | Show version and system info        |
| `doctor`   | Run diagnostics                     |
| `exit`     | Close Sentinel                      |

All commands also work via **natural language** (e.g., "What model am I using?", "Change my API key").

---

## 🔒 Permission System

Sentinel never executes sensitive actions silently. Every risky operation displays:

```
╔══════════════════════════════════════════╗
║  Permission Request                      ║
║                                          ║
║  Plan:    Update LinkedIn headline       ║
║  Action:  Open browser → Edit → Save     ║
║  Risk:    Medium                         ║
║                                          ║
║  [Allow Once]  [Always Allow]  [Cancel]  ║
╚══════════════════════════════════════════╝
```

---

## 📦 npm Scripts

| Command            | Description                    |
| ------------------ | ------------------------------ |
| `npm run dev`      | Start in development mode      |
| `npm run build`    | Build for production           |
| `npm run preview`  | Preview production build       |
| `npm start`        | Launch the built app           |

---

## 🗺️ Roadmap

| #  | Phase                                         | Status      |
| -- | --------------------------------------------- | ----------- |
| 1  | Project scaffold (electron-vite, TS, hotkey)  | ✅ Done     |
| 2  | UI shell (TopBar, BottomBar, Sidebar, etc.)   | ✅ Done     |
| 3  | AI provider — OpenCode Zen + model switcher    | ✅ Done     |
| 4  | Permission engine                              | ✅ Done     |
| 5  | Context awareness (active-win)                 | ✅ Done     |
| 6  | Built-in commands router                       | ✅ Done     |
| 7  | Plugins (fs, terminal, git, apps)              | 🔜 Next    |
| 8  | Notification system (toast)                    | ✅ Done     |
| 9  | Conversation history                           | ⬜ Planned |
| 10 | Installer (`npx @sentinel-ai/install`)          | ⬜ Planned |
| 11 | Logo + final polish                            | ⬜ Planned |

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by [Raycast](https://raycast.com/), [Warp](https://www.warp.dev/), [Claude Desktop](https://claude.ai/), and [Arc Browser](https://arc.net/)
- Built with the [electron-vite](https://electron-vite.org/) framework
- Powered by [OpenCode Zen](https://opencode.ai)

---

<p align="center">
  <strong>🛡️ Sentinel AI — Your desktop, intelligent.</strong>
</p>
