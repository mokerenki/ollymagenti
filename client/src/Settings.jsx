import { useState, useEffect, useCallback } from 'react';

function Settings() {
  const [watchedFolders, setWatchedFolders] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedChatModel, setSelectedChatModel] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('nomic-embed-text');
  const [stats, setStats] = useState({ documents: 0, chunks: 0, storage: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState('');
  const [newFolderRecursive, setNewFolderRecursive] = useState(true);
  const [urlInput, setUrlInput] = useState('');

  // Load data on mount
  useEffect(() => {
    fetchWatchedFolders();
    fetchModels();
    fetchStats();
  }, []);

  const fetchWatchedFolders = async () => {
    try {
      const response = await fetch('/api/watched-folders');
      const data = await response.json();
      setWatchedFolders(data);
    } catch (error) {
      console.error('Failed to fetch watched folders:', error);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      const models = data.models || [];
      setAvailableModels(models);
      
      // Get current chat model from localStorage or default to first
      const savedModel = localStorage.getItem('selectedChatModel');
      if (savedModel && models.find(m => m.name === savedModel)) {
        setSelectedChatModel(savedModel);
      } else if (models.length > 0) {
        setSelectedChatModel(models[0].name);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/documents');
      const docs = await response.json();
      const totalChunks = docs.reduce((sum, d) => sum + (d.chunk_count || 0), 0);
      const totalSize = docs.reduce((sum, d) => sum + (d.file_size || 0), 0);
      
      setStats({
        documents: docs.length,
        chunks: totalChunks,
        storage: totalSize
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleAddFolder = async () => {
    if (!newFolderPath.trim()) {
      setMessage({ type: 'error', text: 'Please enter a folder path' });
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/watched-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: newFolderPath,
          recursive: newFolderRecursive
        })
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: `Now watching: ${newFolderPath}` });
        setNewFolderPath('');
        setShowAddFolder(false);
        fetchWatchedFolders();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to add folder' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleRemoveFolder = async (folderPath) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/watched-folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath })
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: `Stopped watching: ${folderPath}` });
        fetchWatchedFolders();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to remove folder' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleModelChange = (modelName) => {
    setSelectedChatModel(modelName);
    localStorage.setItem('selectedChatModel', modelName);
    setMessage({ type: 'success', text: `Chat model changed to ${modelName}` });
    setTimeout(() => setMessage(null), 2000);
  };

  const handleIndexUrl = async () => {
    if (!urlInput.trim()) {
      setMessage({ type: 'error', text: 'Please enter a URL' });
      return;
    }
    
    // Basic URL validation
    try {
      new URL(urlInput);
    } catch (error) {
      setMessage({ type: 'error', text: 'Please enter a valid URL (e.g., https://example.com)' });
      return;
    }
    
    setIsLoading(true);
    setMessage({ type: 'info', text: `Indexing ${urlInput}... This may take 30-60 seconds.` });
    
    try {
      const response = await fetch('/api/index-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      });
      
      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        setMessage({ type: 'success', text: `✓ Indexed: "${result.title}" (${result.chunkCount} chunks)` });
        setUrlInput('');
        fetchStats(); // Refresh stats
      } else if (result.status === 'duplicate') {
        setMessage({ type: 'warning', text: 'This URL has already been indexed.' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to index URL' });
      }
    } catch (error) {
      console.error('URL indexing error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to index URL. Check if the URL is accessible.' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleBackup = async () => {
    setIsLoading(true);
    setMessage({ type: 'info', text: 'Creating backup...' });

    try {
      const response = await fetch('/api/backup');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ollymagenti-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Backup downloaded successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Backup failed: ' + error.message });
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleRestore = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const confirmRestore = window.confirm(
      'WARNING: Restoring will replace ALL your current data (conversations, documents, settings).\n\n' +
      'Make sure you have a backup first.\n\n' +
      'The application will need to be restarted after restore.\n\n' +
      'Are you sure?'
    );

    if (!confirmRestore) return;

    setIsLoading(true);
    setMessage({ type: 'info', text: 'Restoring backup... This may take a moment.' });

    const formData = new FormData();
    formData.append('backup', file);

    try {
      const response = await fetch('/api/restore', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage({ type: 'success', text: 'Backup restored! Please restart the application.' });
        event.target.value = '';
      } else {
        setMessage({ type: 'error', text: result.error || 'Restore failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Restore failed: ' + error.message });
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Settings</h2>
      
      {/* Message toast */}
      {message && (
        <div style={{
          padding: '0.75rem',
          marginBottom: '1rem',
          borderRadius: '8px',
          backgroundColor: message.type === 'success' ? '#d4edda' : 
                          message.type === 'error' ? '#f8d7da' : 
                          message.type === 'warning' ? '#fff3cd' : '#d1ecf1',
          color: message.type === 'success' ? '#155724' : 
                 message.type === 'error' ? '#721c24' : 
                 message.type === 'warning' ? '#856404' : '#0c5460',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : 
                                 message.type === 'error' ? '#f5c6cb' : 
                                 message.type === 'warning' ? '#ffeeba' : '#bee5d4'}`
        }}>
          {message.type === 'info' && 'ℹ️ '}
          {message.type === 'success' && '✅ '}
          {message.type === 'error' && '❌ '}
          {message.type === 'warning' && '⚠️ '}
          {message.text}
        </div>
      )}
      
      {/* ============================================ */}
      {/* SECTION 1: Model Configuration */}
      {/* ============================================ */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🤖</span> Chat Model
        </h3>
        <p style={{ fontSize: '14px', color: '#6c757d', marginBottom: '1rem' }}>
          Select which AI model to use for conversations.
        </p>
        
        <select
          value={selectedChatModel}
          onChange={(e) => handleModelChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '6px',
            border: '1px solid #ced4da',
            fontSize: '14px'
          }}
        >
          {availableModels.map(model => (
            <option key={model.name} value={model.name}>
              {model.name} ({Math.round(model.size / 1024 / 1024 / 1024)} GB)
            </option>
          ))}
        </select>
        
        <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '0.5rem' }}>
          Embedding model: <strong>{embeddingModel}</strong> (used for document search)
        </div>
      </div>
      
      {/* ============================================ */}
      {/* SECTION 2: Watched Folders */}
      {/* ============================================ */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📁</span> Watched Folders
        </h3>
        <p style={{ fontSize: '14px', color: '#6c757d', marginBottom: '1rem' }}>
          Files added to these folders will be automatically indexed.
        </p>
        
        {watchedFolders.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '1.5rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            color: '#6c757d',
            fontSize: '14px'
          }}>
            No folders being watched. Add one below.
          </div>
        ) : (
          <div style={{ marginBottom: '1rem' }}>
            {watchedFolders.map((folder, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem',
                  borderBottom: '1px solid #e9ecef',
                  fontSize: '13px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>{folder.path}</div>
                  <div style={{ fontSize: '11px', color: '#6c757d' }}>
                    {folder.recursive ? '📂 Including subfolders' : '📄 Top folder only'}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFolder(folder.path)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: 'black',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        
        {!showAddFolder ? (
          <button
            onClick={() => setShowAddFolder(true)}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: 'black',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + Add Folder
          </button>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <input
              type="text"
              value={newFolderPath}
              onChange={(e) => setNewFolderPath(e.target.value)}
              placeholder="e.g., C:\Users\HUAWEI\Documents"
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #ced4da',
                marginBottom: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={newFolderRecursive}
                onChange={(e) => setNewFolderRecursive(e.target.checked)}
              />
              Watch subfolders recursively
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleAddFolder}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  backgroundColor: 'black',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => {
                  setShowAddFolder(false);
                  setNewFolderPath('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'black',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* ============================================ */}
      {/* SECTION 3: URL Indexing */}
      {/* ============================================ */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🌐</span> Index Web Pages
        </h3>
        <p style={{ fontSize: '14px', color: '#6c757d', marginBottom: '1rem' }}>
          Paste a URL to add a web page to your knowledge base. Content is stored locally.
        </p>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/article"
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: '6px',
              border: '1px solid #ced4da',
              fontSize: '14px'
            }}
            disabled={isLoading}
          />
          <button
            onClick={handleIndexUrl}
            disabled={isLoading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'black',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            {isLoading ? 'Indexing...' : 'Index URL'}
          </button>
        </div>
        
        <div style={{ fontSize: '12px', color: '#6c757d' }}>
          💡 Supported: Articles, blog posts, documentation pages<br />
          ⚠️ Pages behind paywalls or with dynamic content may not work
        </div>
      </div>
      
      {/* ============================================ */}
      {/* SECTION 4: Storage */}
      {/* ============================================ */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>💾</span> Storage
        </h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '14px' }}>
          <span>Documents indexed:</span>
          <strong>{stats.documents}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '14px' }}>
          <span>Total chunks:</span>
          <strong>{stats.chunks}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '14px' }}>
          <span>Storage used:</span>
          <strong>{formatFileSize(stats.storage)}</strong>
        </div>
        
        <div style={{
          padding: '0.75rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#6c757d'
        }}>
          📍 Database: <code style={{ fontSize: '11px' }}>ollymagenti.db</code><br />
          📍 Vectors: <code style={{ fontSize: '11px' }}>vectordb/</code>
        </div>
      </div>

            {/* ============================================ */}
      {/* SECTION: Backup & Restore */}
      {/* ============================================ */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>💿</span> Backup & Restore
        </h3>
        <p style={{ fontSize: '14px', color: '#6c757d', marginBottom: '1rem' }}>
          Export all your data (conversations, documents, vectors) or restore from a backup.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            id="backupBtn"
            onClick={handleBackup}
            disabled={isLoading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'black',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            💾 Download Backup
          </button>
          
          <label style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'black',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'inline-block'
          }}>
            📂 Restore from Backup
            <input
              type="file"
              accept=".zip"
              id="restoreInput"
              style={{ display: 'none' }}
              onChange={handleRestore}
            />
          </label>
        </div>
        
        <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '0.75rem' }}>
          ⚠️ Restoring will replace all current data. Create a backup first.
        </div>
      </div>
      
      {/* ============================================ */}
      {/* SECTION 5: About */}
      {/* ============================================ */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '12px',
        padding: '1.25rem'
      }}>
        <h3 style={{ marginBottom: '0.5rem' }}>About OllyMagenti</h3>
        <p style={{ fontSize: '13px', color: '#6c757d', marginBottom: '0.5rem' }}>
          A private, offline-first AI knowledge base.
        </p>
        <p style={{ fontSize: '12px', color: '#6c757d' }}>
          ✅ All data stays on your machine<br />
          ✅ Works 100% offline<br />
          ✅ No cloud APIs or subscriptions
        </p>
      </div>
    </div>
  );
}

export default Settings;