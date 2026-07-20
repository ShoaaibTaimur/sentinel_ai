# 🛡️ Sentinel AI

**A keyboard-first, system-wide AI assistant for your desktop.**

Sentinel AI is not a browser extension or a chatbot widget — it's a true operating system assistant that integrates with your files, terminal, git, default browser, and running apps. Launch it with a hotkey, tell it what you want, and it plans, confirms, and executes.

> 🌟 **Status:** Version 1.0 Major Release complete. Refined Tokyo Night / Cyberpunk design system, responsive landing page, cross-platform fast file indexing/spotlight searches, multi-IDE project launching, and permission-gated active code-editing are fully operational.

---

## ✨ Features (v1.0 Release)

- **⌨️ Keyboard-First** — Every action is accessible via keyboard. Mouse is never required.
- **🧠 Active Window & Context Aware** — Detects your active window, app, URL, and project automatically. Senses active workspace file locations and paths in real-time.
- **🔍 Fast System-Wide Search** — Cross-platform native indexing using Spotlight (`mdfind`) on macOS, PowerShell `Get-ChildItem` on Windows, and fast `find` exclusions on Linux.
- **📁 Multi-IDE Project Launcher** — Instantly open any folder, project, or file inside VS Code (`code`), Cursor, Trae, or Windsurf directly from natural language requests.
- **📝 Fast Code Editing & Reading** — Active code file detection and fast overwriting with `fs_read_active_file` and `fs_edit_file` to edit code in real-time with permission approval.
- **🌐 Isolated Browser Agent (MCP)** — Seamless web automation (clicking, typing, creating notes like Google Keep) using an isolated Chromium context that runs perfectly on Wayland, X11, macOS, and Windows.
- **🔒 Permission Engine** — Every sensitive action shows a plan, command, reason, and risk level before execution. You approve or cancel.
- **⚡ Global Hotkey** — Launch instantly with `Super+Space`.
- **🎨 Premium UI** — Tokyo Night theme with glassmorphism header, smooth entry stagger animations for messages, and pulse thinking loaders.

---

## 🆚 Comparison: Sentinel AI vs Other Assistants

| Feature / Metric | 🛡️ Sentinel AI | 💬 ChatGPT / Claude Web | 💻 GitHub Copilot | 🏠 Local LLMs (Ollama) |
| :--- | :--- | :--- | :--- | :--- |
| **System-wide Integration** | **Full** (Files, Terminal, Apps) | **None** (Browser only) | **Limited** (Inside IDE) | **None** (CLI / API only) |
| **Active File Reading/Writing** | **Yes** (With permissions) | ❌ No | ⚠️ Inside IDE only | ❌ No |
| **Multi-IDE Launcher** | **Yes** (VS Code, Cursor, Trae) | ❌ No | ❌ No | ❌ No |
| **Hands-free Web Automation** | **Yes** (Isolated Chromium MCP) | ❌ No | ❌ No | ❌ No |
| **Speed & Indexing** | **Instant** (Spotlight / PowerShell) | ❌ No | ❌ No | ⚠️ Slow recursion |
| **Privacy & Control** | **Gatekeeper Permission Dialog** | ⚠️ Closed Cloud | ⚠️ Telemetry | **High** (Local but dumb) |

### Pros of Sentinel AI:
1. **Total System Authority**: Unlike web apps, Sentinel AI interacts directly with shell environments, browser processes, and folder paths.
2. **Contextual Awareness**: It automatically parses what active project you are looking at, eliminating copy-pasting code snippets.
3. **Safety First**: High-risk commands (like deleting directories, running scripts, pushing git commits) are stopped by a visual permission dialog.

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

---

## 🛠️ Tech Stack & Compatibility

Sentinel AI is designed to support **Windows**, **macOS**, and **Linux** out of the box.

| Layer | Windows | macOS | Linux |
| :--- | :--- | :--- | :--- |
| **Window/CWD Hook** | `active-win` | `active-win` + AppleScript | `active-win` (Wayland/X11 check) |
| **Fast Search** | PowerShell Indexer | Spotlight (`mdfind`) | Native `find` exclusions |
| **IDE Launcher** | `cmd.exe` / `powershell` | Shell exec | Wayland desktop portal / `exec` |
| **Automated Browser** | Chromium | Chromium | Chromium (X11 / Wayland sandbox) |

---

## 📁 Project Structure

```
sentinel-ai/
├── main/                 # Electron main process (v1.0)
│   ├── src/
│   │   ├── main/
│   │   │   ├── index.ts        # App Entry & Hotkey registration
│   │   │   ├── ipc/            # IPC handlers (AI prompt, permissions, context)
│   │   │   └── plugins/        # System tools: filesystem, applications, gui
│   │   └── renderer/           # React Chat Desktop Shell (Tokyo Night Theme)
├── frontend/             # Vite + React + TS Marketing Landing Page
│   ├── src/
│   │   ├── App.tsx             # Marketing Hero, Features, Comparison grid
│   │   └── index.css           # Tokyo Night CSS tokens & custom animations
└── start.sh
```

---

## 🗺️ Roadmap

| Phase | Description | Status |
| :--- | :--- | :--- |
| 1 | Project scaffold (electron-vite, TS, hotkey) | ✅ Done |
| 2 | UI shell (TopBar, BottomBar, Sidebar, etc.) | ✅ Done |
| 3 | AI provider — OpenCode Zen + model switcher | ✅ Done |
| 4 | Permission engine | ✅ Done |
| 5 | Context awareness (active-win) | ✅ Done |
| 6 | System Indexing & Platform Compatibility | ✅ Done |
| 7 | Plugins (fs, terminal, git, apps) | ✅ Done |
| 8 | Notification system (toast) | ✅ Done |
| 9 | Conversation history | ⬜ Planned |
| 10 | Installer (`npx @sentinel-ai/install`) | ⬜ Planned |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>🛡️ Sentinel AI — Your desktop, intelligent.</strong>
</p>
