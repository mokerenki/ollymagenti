<!--- OllyMagenti GitHub README — Homepage --->

<p align="center">
  <img src="https://img.icons8.com/fluency/96/brain.png" alt="OllyMagenti" width="80">
</p>

<h1 align="center">🧠 OllyMagenti</h1>

<p align="center">
  <strong>A private, offline-first AI knowledge base that runs entirely on your local machine.</strong>
</p>

<p align="center">
  <a href="#-download"><img src="https://img.shields.io/badge/⬇️_Download_for_Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Download"></a>
  <a href="#-quick-start"><img src="https://img.shields.io/badge/🚀_Quick_Start-6366f1?style=for-the-badge" alt="Quick Start"></a>
  <a href="#-features"><img src="https://img.shields.io/badge/✨_Features-10b981?style=for-the-badge" alt="Features"></a>
  <a href="#-privacy-guarantee"><img src="https://img.shields.io/badge/🔒_Privacy-ef4444?style=for-the-badge" alt="Privacy"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows%2010%2B-brightgreen.svg" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/offline-ready-darkblue.svg" alt="Offline Ready">
</p>

---

## 🎯 What Is OllyMagenti?

OllyMagenti is your **private AI knowledge base**. Think of it as ChatGPT that runs on your laptop, reads your documents, and never sends your data anywhere.

| You Can | You Don't Need |
|---------|----------------|
| ✅ Chat with AI offline | ❌ Internet connection |
| ✅ Upload PDFs, Word docs, TXT files | ❌ Cloud subscription |
| ✅ Ask questions about your documents | ❌ Data leaving your machine |
| ✅ Auto-index watched folders | ❌ Technical expertise |
| ✅ Index web pages locally | ❌ API keys or accounts |

---

## 📥 Download

<p align="center">
  <a href="https://github.com/YOUR_USERNAME/ollymagenti/releases/download/v1.0.0/OllyMagenti-Setup.exe">
    <img src="https://img.shields.io/badge/⬇️_Download_Installer_(Windows)-0078D6?style=for-the-badge&logo=windows&logoColor=white&logoSize=auto&labelColor=white&color=0078D6" alt="Download for Windows" width="300">
  </a>
</p>

<p align="center">
  <strong>Version 1.0.0</strong> • 1.2 GB • Windows 10/11
</p>

| Platform | Status | Get It |
|----------|--------|--------|
| 🪟 Windows | ✅ Available | [Download Installer](https://github.com/YOUR_USERNAME/ollymagenti/releases/download/v1.0.0/OllyMagenti-Setup.exe) |
| 🍎 macOS | 🚧 Coming Soon | [Join Waitlist](mailto:hello@ollymagenti.com?subject=macOS%20Waitlist) |
| 🐧 Linux | 🚧 Coming Soon | [Join Waitlist](mailto:hello@ollymagenti.com?subject=Linux%20Waitlist) |
| 📱 iOS/Android | 🔜 Planned | [Join Waitlist](mailto:hello@ollymagenti.com?subject=Mobile%20Waitlist) |

---

## ✨ Features

| | Feature | What It Does |
|---|---------|---------------|
| 💬 | **Local Chat** | Chat with Llama, Mistral, or Gemma — completely offline |
| 📚 | **Knowledge Base** | Upload PDF, DOCX, TXT files — AI answers questions about them |
| 🔍 | **RAG** | Retrieval-Augmented Generation with source citations |
| 📁 | **Folder Watcher** | Auto-index files dropped into watched folders — no manual uploads |
| 🌐 | **URL Indexing** | Paste any URL — index web articles locally, search offline forever |
| 💾 | **Backup & Restore** | Export all your data — move between machines, never lose your knowledge |
| 🚫 | **Offline Mode** | Works 100% offline — no cloud APIs, no telemetry, no data leaving your machine |

---

## 🔒 Privacy Guarantee

<p align="center">
  <img src="https://img.shields.io/badge/🔒_Your_Data_Never_Leaves_Your_Computer-0f172a?style=for-the-badge" alt="Privacy Guarantee">
</p>

| Question | Answer |
|----------|--------|
| Where do my documents go? | **Nowhere.** They stay on your computer. |
| Does OllyMagenti call home? | **No.** Zero telemetry. Zero analytics. Zero external requests. |
| What about the AI model? | **Runs locally via Ollama.** No cloud API calls. Ever. |
| Can I use it offline? | **Yes.** Works 100% offline after initial setup. |
| Who has access to my data? | **Only you.** Not even us. |

> **We can't see your data. We don't want to. That's the point.**

---

## 🚀 Quick Start

### Prerequisites (One-Time Setup)

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Operating System | Windows 10 | Windows 11 |
| RAM | 8GB | 16GB |
| Disk Space | 10GB | 20GB |
| Internet | Required once (for download) | — |

### Option 1: One-Click Installer (Recommended)

```mermaid
flowchart LR
    A[Download Installer] --> B[Double-click .exe]
    B --> C[Follow Wizard]
    C --> D[Auto-installs Ollama]
    D --> E[Pulls Starter Model]
    E --> F[Start Chatting]

Download the installer from Releases

Double-click OllyMagenti-Setup.exe

Follow the wizard — Ollama is installed automatically

Wait 3-5 minutes — The starter AI model downloads once

Start chatting — Your browser opens to OllyMagenti

💡 First launch takes 10-20 seconds while the AI model loads. Subsequent launches are instant.


## OPT 2

# Clone the repository
git clone https://github.com/YOUR_USERNAME/ollymagenti.git
cd ollymagenti

# Install dependencies
npm install

# Install Ollama (if not already installed)
# Download from https://ollama.com

# Pull required models
ollama pull llama3.2:3b
ollama pull nomic-embed-text

# Start the backend
node server/index.js

# In another terminal, start the frontend
npx vite client --port 5173

Open your browser to http://localhost:5173

One-Click Launcher (Windows)
Double-click start-ollymagenti.bat — both servers start automatically.

# Architecture

## Layer 1: Chat + Persistence
*   Streaming chat with `Ollama API`
*   `SQLite` for conversation history
*   Auto-naming of conversations

## Layer 2: Knowledge Base (RAG)
*   Document upload (PDF, DOCX, TXT)
*   Smart chunking with paragraph preservation
*   `nomic-embed-text` for embeddings
*   `LanceDB` for vector storage
*   Source-attributed answers

## Layer 3: Workflow Integration
*   Folder watcher (auto-index)
*   URL indexing with `Readability`
*   Settings management
*   Offline status indicator
*   Backup & restore


# Tech Stack

| Category        | Technologies                                       |
| :-------------- | :------------------------------------------------- |
| **Backend**     | Node.js, Express, SQLite                           |
| **Frontend**    | React, Vite                                        |
| **AI**          | Ollama (Llama, Mistral, Gemma, nomic-embed-text) |
| **Vector DB**   | LanceDB                                            |
| **File Watching** | Chokidar                                           |
| **Document Parsing** | pdf-parse, mammoth                                 |
| **URL Extraction** | @mozilla/readability                               |


ollymagenti/
├── server/
│   ├── index.js          # Express server, API endpoints
│   ├── database.js       # SQLite operations
│   ├── vectorDb.js       # LanceDB vector storage
│   ├── chunker.js        # Document chunking
│   ├── embedding.js      # Ollama embedding service
│   ├── documentQueue.js  # Background processing
│   ├── folderWatcher.js  # Chokidar file watching
│   └── urlIndexer.js     # Web page extraction
├── client/
│   ├── src/
│   │   ├── Chat.jsx      # Main chat interface
│   │   ├── DocumentManager.jsx
│   │   ├── Settings.jsx
│   │   └── index.css     # Global styles
│   └── index.html
├── start-ollymagenti.bat # One-click launcher (Windows)
└── stop-ollymagenti.bat

🤝 Contributing
We welcome contributions! Open source is how we keep OllyMagenti free and private.


🙋‍♀️ FAQ
Do I need an internet connection?
Only for the initial download and model pull. After that, OllyMagenti works 100% offline.

Can I use my own models?
Yes. Any model supported by Ollama works. Switch models from the dropdown in the chat interface.

How secure is my data?
Your data never leaves your computer. No cloud APIs. No telemetry. We can't see your documents even if we wanted to.

What file formats are supported?
PDF, Word (.docx), and plain text (.txt). More formats coming soon.

How much does it cost?
Nothing. OllyMagenti is free forever for individual use. Enterprise features may be paid in the future.

Why is the download not working yet?
The Windows installer is being finalized. Join the waitlist for early access.

