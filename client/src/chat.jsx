import { useState, useRef, useEffect } from 'react';
import DocumentManager from './DocumentManager';
import Settings from './Settings';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [useRag, setUseRag] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Monitor offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch available models
  useEffect(() => {
    fetchAvailableModels();
    fetchConversations();
  }, []);

  // Refresh conversations periodically to catch updated titles
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentConversationId) {
        fetchConversations();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [currentConversationId]);

  const fetchAvailableModels = async () => {
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      const models = data.models || [];
      setAvailableModels(models);
      if (models.length > 0 && !selectedModel) {
        setSelectedModel(models[0].name);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`);
      const data = await response.json();
      setCurrentConversationId(conversationId);
      setSelectedModel(data.model);
      const chatMessages = data.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      setMessages(chatMessages);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setInput('');
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !selectedModel) return;

    const userMessage = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    setMessages([...updatedMessages, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          model: selectedModel,
          conversationId: currentConversationId,
          useRag: useRag,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        accumulatedContent += chunk;
        
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'assistant', content: accumulatedContent };
          return newMessages;
        });
      }
      
      await fetchConversations();
      
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'assistant', content: 'Error: Could not reach Ollama. Make sure it is running.' };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
   <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', sans-serif", background: '#f9fafb' }}> 
      {/* Sidebar */}
      <div style={{ 
  width: sidebarOpen ? '280px' : '0', 
  overflow: 'hidden',
  transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  backgroundColor: 'white',
  borderRight: '1px solid #e5e7eb',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '2px 0 8px rgba(0,0,0,0.02)'
}}>
        <div style={{ padding: '1rem' }}>
<button
  onClick={startNewConversation}
  style={{
    width: '100%',
    padding: '0.625rem',
    background: 'black',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginBottom: '1.5rem',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
  }}
  onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
  onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
>
  + New Chat
</button>
          <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '0.5rem' }}>
            Previous Chats
          </div>
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              style={{
                padding: '0.5rem',
                marginBottom: '0.25rem',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: currentConversationId === conv.id ? '#e9ecef' : 'transparent',
                fontSize: '14px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {conv.title}
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid #dee2e6', padding: '0 1rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex' }}>
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: activeTab === 'chat' ? 'black' : 'transparent',
                color: activeTab === 'chat' ? 'white' : '#495057',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                marginRight: '0.5rem'
              }}
            >
              💬 Chat
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: activeTab === 'docs' ? 'black' : 'transparent',
                color: activeTab === 'docs' ? 'white' : '#495057',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                marginRight: '0.5rem'
              }}
            >
              📚 Knowledge Base
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: activeTab === 'settings' ? 'black' : 'transparent',
                color: activeTab === 'settings' ? 'white' : '#495057',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer'
              }}
            >
              ⚙️ Settings
            </button>
          </div>
          
          {/* Offline Status Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            backgroundColor: isOnline ? '#d4edda' : '#f8d7da',
            border: `1px solid ${isOnline ? '#c3e6cb' : '#f5c6cb'}`,
            fontSize: '12px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isOnline ? '#28a745' : '#dc3545',
              animation: isOnline ? 'pulse 2s infinite' : 'none'
            }} />
            <span style={{ color: isOnline ? '#155724' : '#721c24' }}>
              {isOnline ? 'Online' : 'Offline Mode'}
            </span>
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {activeTab === 'chat' ? (
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Toggle sidebar button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                  position: 'fixed',
                  left: '1rem',
                  top: '1rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'black',
                  color: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  zIndex: 100
                }}
              >
                ☰
              </button>

              {/* Model selector and RAG toggle */}
              <div style={{ marginBottom: '1rem', padding: '0.5rem', borderBottom: '1px solid #ccc', marginTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ marginRight: '0.5rem', fontWeight: 'bold' }}>Model:</label>
                    <select 
                      value={selectedModel} 
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={isLoading}
                      style={{ padding: '0.25rem 0.5rem', borderRadius: '4px' }}
                    >
                      {availableModels.length === 0 && (
                        <option value="">Loading models...</option>
                      )}
                      {availableModels.map(model => (
                        <option key={model.name} value={model.name}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={useRag}
                      onChange={(e) => setUseRag(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px' }}>🔍 Use documents (RAG)</span>
                  </label>
                </div>
                {availableModels.length === 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '12px', color: '#e67e22' }}>
                    No models found. Make sure Ollama is running.
                  </div>
                )}
                {useRag && (
                  <div style={{ marginTop: '0.5rem', fontSize: '12px', color: '#6c757d' }}>
                    Answers will include information from your uploaded documents
                  </div>
                )}
              </div>

              {/* Messages area */}
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#999', marginTop: '2rem' }}>
                    Send a message to start chatting with {selectedModel || 'AI'}
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginBottom: '1rem',
                      textAlign: msg.role === 'user' ? 'right' : 'left',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '0.625rem 1rem',
                        borderRadius: '18px',
                        background: msg.role === 'user'
                          ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                          : 'white',
                        color: msg.role === 'user' ? 'white' : '#1f2937',
                        maxWidth: '75%',
                        wordWrap: 'break-word',
                        boxShadow: msg.role === 'assistant' ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' : 'none',
                        border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none'
                      }}
                    >
                      <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong> {msg.content || (msg.role === 'assistant' && isLoading ? '...' : '')}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <textarea
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyPress={handleKeyPress}
  placeholder="Type your message..."
  disabled={isLoading}
  style={{
    flex: 1,
    padding: '0.75rem',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    resize: 'none',
    fontFamily: 'inherit',
    fontSize: '14px',
    height: '60px',
    transition: 'all 0.2s ease',
    outline: 'none'
  }}
  onFocus={(e) => e.target.style.borderColor = '#6366f1'}
  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
/>
                <button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim() || !selectedModel}
                  style={{
                    padding: '0 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'black',
                    color: 'white',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          ) : activeTab === 'docs' ? (
            <DocumentManager />
          ) : (
            <Settings />
          )}
        </div>
      </div>
      
      {/* Add pulse animation style */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default Chat;