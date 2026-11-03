# CodeMind — AI Engineering Intelligence Platform

<p align="center">
  <img src="media/logo.png" alt="CodeMind Logo" width="128" height="128" />
</p>

<p align="center">
  <strong>An autonomous AI Engineering Intelligence Platform embedded inside Visual Studio Code.</strong><br>
  Builds a continuously updated graph model of software systems and reasons over code, architecture, history, configuration, dependencies, and runtime behavior.
</p>

<p align="center">
  <a href="https://github.com/ajaishanth-sg/Codemind-Agent"><img src="https://img.shields.io/badge/Repository-GitHub-blue.svg" alt="GitHub Repo"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"></a>
  <a href="https://code.visualstudio.com/"><img src="https://img.shields.io/badge/VS%20Code-%5E1.90.0-purple.svg" alt="VS Code Version"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg" alt="Node Version"></a>
</p>

---

## 📖 Overview

Traditional AI coding assistants function merely as shallow Q&A chatbots: `Question → LLM → Guesswork`. They lack structural awareness of dependencies, codebase hierarchy, architectural constraints, and runtime changes.

**CodeMind** transforms Visual Studio Code into an autonomous software engineering command center. Powered by a **Three-Brain Architecture** and a deterministic **Project Knowledge Graph**, CodeMind understands not just individual syntax snippets, but your system's entire architectural ecosystem.

---

## 🧠 The Three-Brain Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   Visual Studio Code                   │
                    │               Intelligence Dashboard UI                │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │  Orchestration Engine │
                                    └─────┬───────────┬─────┘
                                          │           │
            ┌─────────────────────────────┘           └─────────────────────────────┐
            ▼                                                                       ▼
┌───────────────────────┐                                               ┌───────────────────────┐
│      FACT BRAIN       │                                               │     MEMORY BRAIN      │
│ "What is true now?"   │                                               │ "What happened past?" │
├───────────────────────┤                                               ├───────────────────────┤
│ • AST Code Analysis   │                                               │ • Temporal SQLite DB  │
│ • Symbol Relationships│                                               │ • Node-Edge Topology  │
│ • Runtime Diagnostics │                                               │ • Change History      │
│ • Config & Workspace  │                                               │ • Architecture State  │
└───────────┬───────────┘                                               └───────────┬───────────┘
            │                                                                       │
            └─────────────────────────────┬─────────────────────────────────────────┘
                                          │
                               ┌──────────▼──────────┐
                               │   REASONING BRAIN   │
                               │ "What does it mean?"│
                               ├─────────────────────┤
                               │ • LLM Multi-Provider│
                               │ • Autonomous Tools  │
                               │ • Terminal Control  │
                               │ • Live Typewriter   │
                               └─────────────────────┘
```

1. **Fact Brain:** *"What is true right now?"*
   - Analyzes TypeScript/JavaScript ASTs using `ts-morph`.
   - Extracts functions, classes, interfaces, method declarations, and import bindings.
   - Monitors active diagnostics, open editors, and workspace configuration files.

2. **Memory Brain:** *"What happened before?"*
   - Powered by a local SQLite database (`better-sqlite3`).
   - Maintains an indexed, deterministic relational graph of code nodes (files, classes, functions, modules) and directional relationship edges (`contains`, `imports`, `calls`).
   - Enables temporal queries to evaluate diffs, breaking changes, and architecture evolution.

3. **Reasoning Brain:** *"What does it mean & what to do next?"*
   - Coordinates multi-turn reasoning across frontier LLMs.
   - Autonomous planning, debugging, and multi-file code scaffolding.
   - Chained tool execution with human-in-the-loop permission approvals for system commands.

---

## ✨ Key Features

### 🚀 Autonomous Multi-File Project Scaffolding
- Describe any application or feature in natural language.
- CodeMind plans and autonomously writes folder hierarchies, configuration files, backend APIs, and frontend views.
- **Visual Typewriter Animation:** Watch CodeMind stream code directly into active VS Code editor tabs in real time.

### 🌐 Frontier & Local LLM Provider Support
Switch seamlessly between cloud providers and local private inference engines:
- **Groq:** Ultra-low latency inference (Llama 3.3, Llama 3.1 70B/8B, etc.).
- **OpenAI:** GPT-4o, GPT-4-turbo, o1, o3-mini.
- **Anthropic:** Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku.
- **Google Gemini:** Gemini 1.5 Pro, Gemini 1.5 Flash.
- **xAI:** Grok-beta, Grok-2.
- **Ollama:** Private local inference with automated `/api/tags` model discovery.
- **Custom OpenAI-Compatible API:** Connect to vLLM, LM Studio, Ollama, OpenRouter, or custom cloud endpoints.

### 🛠️ Built-in Autonomous Tool Executor
CodeMind executes tools in an iterative feedback loop:
- `create_and_write_file`: Dynamically creates directories and streams generated code directly into the workspace.
- `execute_terminal_command`: Runs CLI operations (such as `npm install`, `git`, build scripts) with safe, one-click authorization cards in the UI.
- `search_web`: Queries DuckDuckGo for live API documentation, package versions, and GitHub reference implementations.
- `fetch_url_content`: Retrieves raw text from external URLs and GitHub repositories to incorporate up-to-date context.

### 📊 Modern Intelligence Dashboard
- Sleek, VS Code theme-adaptive webview sidebar with elevated UI code cards.
- Integrated syntax highlighting (`highlight.js`) and GitHub-flavored markdown.
- Real-time generation metrics with response execution latency tracking.
- Persistent session chat history saved to workspace state.

---

## 📂 Project Architecture

```
codemind/
├── .codemind/
│   ├── architecture.md          # 7-layer architecture definition
│   └── vision.md                # System vision & design goals
├── media/
│   ├── logo.png                 # Platform branding (PNG)
│   └── logo.svg                 # Activity bar vector icon
├── src/
│   ├── extension.ts             # Extension activation lifecycle
│   ├── commands/
│   │   └── index.ts             # Command handlers & webview bridge
│   ├── engine/
│   │   ├── orchestrator.ts      # Workspace scanner & coordination
│   │   ├── analyzers/
│   │   │   └── typescript.ts    # AST parsing with ts-morph
│   │   ├── context/
│   │   │   └── index.ts         # Context aggregator (diagnostics, files, active tab)
│   │   ├── graph/
│   │   │   └── db.ts            # SQLite knowledge graph repository
│   │   └── reasoning/
│   │       ├── executor.ts      # Tool execution engine (file writing, shell, web)
│   │       ├── groq.ts          # Groq reasoner implementation
│   │       └── orchestrator.ts  # Multi-provider LLM orchestration & streaming
│   ├── events/
│   │   └── index.ts             # VS Code workspace event listeners
│   └── ui/
│       ├── index.ts             # Sidebar registration
│       └── SidebarProvider.ts   # Webview HTML/CSS/JS frontend dashboard
├── package.json                 # Manifest, configuration & contributions
├── tsconfig.json                # TypeScript compiler configuration
└── README.md                    # Platform documentation
```

---

## 🛠️ Getting Started

### Prerequisites
- [VS Code](https://code.visualstudio.com/) version `1.90.0` or higher
- [Node.js](https://nodejs.org/) `v18.x` or later
- [npm](https://www.npmjs.com/) or `pnpm`

### Installation & Build

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ajaishanth-sg/Codemind-Agent.git
   cd Codemind-Agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Compile the extension:**
   ```bash
   npm run compile
   ```

4. **Bundle for production with esbuild:**
   ```bash
   npm run package
   ```

5. **Package into `.vsix` (optional):**
   ```bash
   npx @vscode/vsce package
   ```

### Debugging in VS Code
- Press `F5` (or select **Run > Start Debugging**) inside VS Code to launch an **Extension Development Host** window with CodeMind loaded.

---

## ⚙️ Configuration & Usage

1. Open any workspace in VS Code.
2. Click on the **CodeMind** icon in the Activity Bar to open the **Intelligence Dashboard**.
3. Open the **Settings** panel:
   - Select your desired **Provider** (e.g. `Groq`, `OpenAI`, `Anthropic`, `Gemini`, `Ollama`, or `Custom API`).
   - Enter your **API Key** (or specify local base URL, e.g. `http://localhost:11434` for Ollama).
   - Click **Save / Connect**.
4. Use the bottom input box to ask architectural questions, request code reviews, or prompt CodeMind to scaffold full features.

### Commands

| Command | Identifier | Description |
|---|---|---|
| **CodeMind: Scan Workspace** | `codemind.scanWorkspace` | Indexes the workspace AST and populates the SQLite graph. |
| **CodeMind: Ask Groq** | `codemind.askGroq` | Opens a quick input prompt to ask questions via Groq. |
| **CodeMind: Webview Ask** | `codemind.handleWebviewAsk` | Internal pipeline dispatching requests from the sidebar UI. |

---

## 🔒 Security & Privacy

- **Local Knowledge Storage:** The deterministic graph database is stored locally inside your workspace storage directory (`codemind_graph.db`).
- **Terminal Execution Guard:** Command execution via tools requires explicit confirmation through interactive approval cards in the UI before running.
- **Zero API Key Leaks:** API keys and credentials are saved in VS Code's secure `workspaceState` / `secrets` and are never hardcoded or tracked in Git.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m "Add amazing feature"`).
4. Push to your branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Crafted with care by <strong><a href="https://github.com/ajaishanth-sg">Ajaishanth SG</a></strong>
</p>
