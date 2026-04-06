import { useState, useEffect, useCallback } from 'react';

function DocumentManager() {
  const [documents, setDocuments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingQueue, setProcessingQueue] = useState({ isProcessing: false, queueLength: 0 });

  // Fetch documents on load
  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  }, []);

  // Fetch queue status
  const fetchQueueStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/documents/queue/status');
      const data = await response.json();
      setProcessingQueue(data);
    } catch (error) {
      console.error('Failed to fetch queue status:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDocuments();
    fetchQueueStatus();
  }, [fetchDocuments, fetchQueueStatus]);

  // Poll for updates every 3 seconds while processing
  useEffect(() => {
    let interval;
    if (processingQueue.isProcessing || processingQueue.queueLength > 0) {
      interval = setInterval(() => {
        fetchDocuments();
        fetchQueueStatus();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [processingQueue.isProcessing, processingQueue.queueLength, fetchDocuments, fetchQueueStatus]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const uploadFile = async (file) => {
    // Validate file size (15MB limit)
    if (file.size > 15 * 1024 * 1024) {
      alert('File too large. Maximum size is 15MB.');
      return;
    }
    
    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(file.type)) {
      alert('Unsupported file type. Please upload PDF, DOCX, or TXT files.');
      return;
    }
    
    setIsLoading(true);
    setUploadStatus({ status: 'uploading', message: `Uploading ${file.name}...` });
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.status === 'duplicate') {
        const confirmReplace = window.confirm(
          `${file.name} already exists in your knowledge base.\n\nUploaded: ${new Date(result.existingDoc.indexed_at).toLocaleString()}\nChunks: ${result.existingDoc.chunk_count}\n\nDo you want to replace it with this new version?`
        );
        
        if (confirmReplace) {
          await replaceDocument(result.existingDoc.id, file);
        } else {
          setUploadStatus({ status: 'cancelled', message: 'Upload cancelled (duplicate)' });
          setTimeout(() => setUploadStatus(null), 3000);
        }
      } else if (result.status === 'queued') {
        setUploadStatus({ status: 'queued', message: `${file.name} added to queue. Processing in background...` });
        // Fetch queue status to see if processing started
        await fetchQueueStatus();
        // Start polling will happen automatically via the useEffect
        setTimeout(() => {
          setUploadStatus({ status: 'processing', message: `${file.name} is being processed...` });
        }, 1000);
      } else {
        setUploadStatus({ status: 'error', message: result.error || 'Upload failed' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({ status: 'error', message: 'Upload failed. Check console for details.' });
    } finally {
      setIsLoading(false);
      // Clear status after 5 seconds for non-processing statuses
      setTimeout(() => {
        if (uploadStatus?.status !== 'processing' && uploadStatus?.status !== 'queued') {
          setUploadStatus(null);
        }
      }, 5000);
    }
  };

  const replaceDocument = async (docId, file) => {
    setUploadStatus({ status: 'replacing', message: `Replacing document...` });
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`/api/documents/${docId}/replace`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.status === 'queued') {
        setUploadStatus({ status: 'success', message: 'Document replaced and queued for re-indexing' });
        fetchDocuments();
        fetchQueueStatus();
      } else {
        setUploadStatus({ status: 'error', message: result.error || 'Replace failed' });
      }
    } catch (error) {
      console.error('Replace error:', error);
      setUploadStatus({ status: 'error', message: 'Replace failed' });
    }
  };

  const deleteDocument = async (docId, docName) => {
    const confirm = window.confirm(`Delete "${docName}" from your knowledge base? This cannot be undone.`);
    if (!confirm) return;
    
    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setDocuments(docs => docs.filter(d => d.id !== docId));
        setUploadStatus({ status: 'success', message: `"${docName}" deleted` });
        setTimeout(() => setUploadStatus(null), 3000);
      } else {
        const error = await response.json();
        alert(`Delete failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Delete failed. Check console for details.');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '1rem', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ marginBottom: '1rem' }}>Knowledge Base</h2>
      
      {/* Queue Status Indicator */}
      {(processingQueue.isProcessing || processingQueue.queueLength > 0) && (
        <div style={{
          padding: '0.5rem 0.75rem',
          marginBottom: '1rem',
          borderRadius: '8px',
          backgroundColor: '#e3f2fd',
          border: '1px solid #90caf9',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>⏳</span>
          <span>
            {processingQueue.isProcessing 
              ? `Processing document... ${processingQueue.queueLength > 0 ? `(${processingQueue.queueLength} waiting)` : ''}`
              : `${processingQueue.queueLength} document(s) waiting in queue`}
          </span>
        </div>
      )}
      
      {/* Upload Status */}
      {uploadStatus && (
        <div style={{
          padding: '0.75rem',
          marginBottom: '1rem',
          borderRadius: '8px',
          backgroundColor: uploadStatus.status === 'error' ? '#fee' : 
                          uploadStatus.status === 'success' ? '#e8f5e9' : 
                          uploadStatus.status === 'processing' ? '#fff3e0' : '#e3f2fd',
          border: `1px solid ${uploadStatus.status === 'error' ? '#fcc' : 
                                 uploadStatus.status === 'success' ? '#c8e6c9' : 
                                 uploadStatus.status === 'processing' ? '#ffe0b2' : '#90caf9'}`,
          color: uploadStatus.status === 'error' ? '#c62828' : 
                 uploadStatus.status === 'success' ? '#2e7d32' : 
                 uploadStatus.status === 'processing' ? '#e65100' : '#1565c0'
        }}>
          {uploadStatus.status === 'processing' && '🔄 '}
          {uploadStatus.status === 'queued' && '📋 '}
          {uploadStatus.status === 'success' && '✅ '}
          {uploadStatus.status === 'error' && '❌ '}
          {uploadStatus.message}
        </div>
      )}
      
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? '#007bff' : '#ccc'}`,
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: isDragging ? '#f0f8ff' : '#fafafa',
          transition: 'all 0.2s',
          marginBottom: '2rem',
          cursor: 'pointer'
        }}
        onClick={() => document.getElementById('fileInput').click()}
      >
        <div style={{ fontSize: '48px', marginBottom: '0.5rem' }}>📄</div>
        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
          Drag & drop a document here
        </div>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '0.5rem' }}>
          or click to browse
        </div>
        <div style={{ fontSize: '12px', color: '#999' }}>
          Supports PDF, Word (.docx), and TXT files (max 15MB)
        </div>
        <input
          id="fileInput"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={isLoading}
        />
      </div>
      
      {/* Document List */}
      <h3 style={{ marginBottom: '0.5rem' }}>Your Documents</h3>
      
      {documents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
          No documents yet. Upload your first document above.
        </div>
      ) : (
        <div>
          {documents.map(doc => (
            <div
              key={doc.id}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#fff'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  📄 {doc.name}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {doc.chunk_count} chunks • {formatFileSize(doc.file_size)} • Indexed {formatDate(doc.indexed_at)}
                </div>
              </div>
              <button
                onClick={() => deleteDocument(doc.id, doc.name)}
                style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: 'black',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = 'rgb(30, 30, 30)'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'black'}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Summary */}
      {documents.length > 0 && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#e9ecef',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#495057'
        }}>
          📊 Total: {documents.length} document(s) • {documents.reduce((sum, d) => sum + d.chunk_count, 0)} chunks
        </div>
      )}
    </div>
  );
}

export default DocumentManager;