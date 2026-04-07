# 🧠 OllyMagenti

### A private, offline-first AI knowledge base that runs entirely on your local machine.

![OllyMagenti Screenshot](https://via.placeholder.com/800x400?text=OllyMagenti+Demo)

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **Local Chat** | Chat with LLMs (Llama, Mistral, Gemma) completely offline |
| 📚 **Knowledge Base** | Upload PDF, DOCX, TXT files - AI answers questions about them |
| 🔍 **RAG** | Retrieval-Augmented Generation with source citations |
| 📁 **Folder Watcher** | Auto-index files dropped into watched folders |
| 🌐 **URL Indexing** | Paste any URL - index web articles locally |
| 💾 **Backup & Restore** | Export/import all your data |
| 🚫 **Offline Mode** | Works 100% offline - no cloud APIs |

## 🚀 Quick Start

### Prerequisites

- [Ollama](https://ollama.com) installed on your machine
- Node.js (v18 or higher)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ollymagenti.git
cd ollymagenti

# Install dependencies
npm install

# Pull a chat model
ollama pull llama3.2:3b

# Pull the embedding model (for document search)
ollama pull nomic-embed-text

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

# Start the application
node server/index.js


# In another terminal:
npx vite client --port 5173


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


#Project structure

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

##Contributing
### Issues and pull requests are welcome!
