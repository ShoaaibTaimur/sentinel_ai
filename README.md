# 🛡️ Sentinel AI (v1.0.4)

**A keyboard-first, system-wide AI desktop assistant.**

Sentinel AI is not a browser extension or a chatbot widget — it's a true operating system assistant that integrates directly with your local files, terminal, git, default browser, running apps, and IDEs. Launch it instantly with `Super+Space` (or `Alt+Space`), tell it what you want, and it plans, confirms, and executes.

> **Platform Availability:** Fully supported on **Linux** & **macOS** 🐧 🍎 *(Windows builds provided upon request 🪟)*.

---

## ✨ Core Features

| Feature | Description |
| :------ | :---------- |
| **⌨️ Keyboard-First** | Global hotkey (`Super+Space` / `Alt+Space`). Mouse is never required. |
| **📌 Workspace Context Badges** | Attach files or folders as active context badges via the `+` file manager button, CLI (`sentinelai .`), or natural language ("open X in workspace"). Click badges to open in OS file manager. |
| **💻 Local CLI Integration** | Run `sentinelai .` from any terminal tab to focus Sentinel AI and automatically pin your working directory. |
| **📁 Multi-IDE Launcher** | Open projects in VS Code (`code`), Cursor, Trae, Antigravity / Antigravity IDE, or Windsurf directly from natural language prompts. |
| **🧠 Active Window Context** | Automatically senses active window title, app name, and URL context. |
| **📝 Fast Code Editing & Reading** | Read active editor files in real-time and execute precision single-file overwrites with user permission approval. |
| **🌐 Isolated Browser Agent (MCP)** | Full web automation (clicking, typing, DOM parsing) in an isolated Chromium context. |
| **🔒 Permission Engine** | Safe execution mode — shows action plan, command details, reason, and risk rating before running sensitive actions. |
| **🎨 Premium Dark UI** | Tokyo Night theme with glassmorphism, smooth animations, and pulse loaders. |

---

## 💻 Local CLI (`sentinelai .`)

Sentinel AI includes a built-in CLI for instant terminal workflow integration:

```bash
# Installed automatically via install.sh or desktop package.
# (If developing from source codebase, run `npm link` inside `main/`)

# Navigate to any project or folder in your terminal
cd ~/my-awesome-project

# Instantly focus Sentinel AI and pin the directory as a workspace context badge
sentinelai .
```

---

## 📁 Project Structure

```
sentinel-ai/
├── main/                 # 🖥️ Electron desktop app (React + Vite + TypeScript)
│   ├── bin/sentinel.js   #   └─ Local CLI executable (sentinelai .)
│   ├── src/main/         #   └─ Main process: IPC handlers, CLI socket, plugins
│   ├── src/renderer/     #   └─ React chat UI shell
│   └── package.json
├── frontend/             # 🌐 Marketing landing page (Vite + React + TS)
│   ├── src/              #   └─ Hero, Features, Comparisons
│   └── package.json
├── .github/workflows/    # ⚙️ GitHub Actions CI/CD (Auto-builds .deb, .AppImage, .dmg, .exe)
├── CONTEXT.md            # 📘 Developer context for AI models
└── start.sh              # 🚀 Dev startup script
```

---

## 🚀 Quick Start (Development)

```bash
# 1. Clone repository
git clone https://github.com/ShoaaibTaimur/sentinel_ai.git
cd sentinel_ai

# 2. Run Desktop App locally
cd main
npm install
npm run dev

# 3. (Optional) Run Landing Page locally
cd ../frontend
npm install
npm run dev
```

---

## 🛠️ Tech Stack

| Layer | Desktop Application | Marketing Website |
| :---- | :------------------ | :---------------- |
| **Framework** | Electron + React + Vite | Vite + React + TypeScript |
| **Language** | TypeScript | TypeScript |
| **Styling** | Vanilla CSS (Tokyo Night theme) | Vanilla CSS + Animations |
| **IPC Communication** | Electron IPC + Unix Domain Sockets | — |
| **AI Integration** | OpenCode Zen AI SDK | — |

---

## 🗺️ Development Roadmap

| Phase | Feature / Milestone | Status |
| :---: | :------------------ | :----: |
| 1 | Project scaffold (electron-vite, TS, hotkey) | ✅ Done |
| 2 | UI shell & Tokyo Night design system | ✅ Done |
| 3 | AI provider & OpenCode Zen model switcher | ✅ Done |
| 4 | Permission engine for safe execution | ✅ Done |
| 5 | Active window context awareness (`active-win`) | ✅ Done |
| 6 | System Indexing & Multi-IDE launcher (VS Code, Cursor, Trae, Antigravity, Windsurf) | ✅ Done |
| 7 | Plugins (fs, terminal, git, apps, mcp-browser) | ✅ Done |
| 8 | Workspace Context Badges (`+` picker & `sentinelai .` CLI socket) | ✅ Done |
| 9 | GitHub Actions auto-release workflow (`v*` tag automated builds) | ✅ Done |
| 10 | Standalone installers & auto-updater | ⬜ Planned |

---

## 📄 License

MIT License — see [LICENSE](main/LICENSE) for details.

---

<p align="center">
  <strong>🛡️ Sentinel AI — Your desktop, intelligent.</strong><br />
  Designed & Developed by <a href="https://taimur.dev">Md Shoaaib Taimur</a>
</p>
