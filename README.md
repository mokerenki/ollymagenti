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

# Start the application
node server/index.js
# In another terminal:
npx vite client --port 5173
