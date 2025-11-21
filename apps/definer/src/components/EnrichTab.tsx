import { useState } from 'react';
import '../styles/EnrichTab.css';

interface EnrichTabProps {
  onEnrich: (data: any) => Promise<void>;
}

export default function EnrichTab({ onEnrich }: EnrichTabProps) {
  const [activeUploadTab, setActiveUploadTab] = useState<'document' | 'url' | 'mcp'>('document');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Document upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // URL state
  const [url, setUrl] = useState('');

  // MCP state
  const [mcpConfig, setMcpConfig] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDocumentUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const API_BASE_URL = import.meta.env.PUBLIC_VITE_API_URL || 'http://localhost:8787/api';

      const response = await fetch(`${API_BASE_URL}/roledefs/enrich/document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('apiKey') || 'dev-local-key'}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process document');
      }

      const enrichedData = await response.json();
      await onEnrich(enrichedData);

      setSuccess('Document processed successfully!');
      setSelectedFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const API_BASE_URL = import.meta.env.PUBLIC_VITE_API_URL || 'http://localhost:8787/api';

      const response = await fetch(`${API_BASE_URL}/roledefs/enrich/url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('apiKey') || 'dev-local-key'}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to process URL');
      }

      const enrichedData = await response.json();
      await onEnrich(enrichedData);

      setSuccess('URL processed successfully!');
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process URL');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMcpSubmit = async () => {
    if (!mcpConfig.trim()) {
      setError('Please enter MCP configuration');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const config = JSON.parse(mcpConfig);

      const API_BASE_URL = import.meta.env.PUBLIC_VITE_API_URL || 'http://localhost:8787/api';

      const response = await fetch(`${API_BASE_URL}/roledefs/enrich/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('apiKey') || 'dev-local-key'}`,
        },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        throw new Error('Failed to process MCP configuration');
      }

      const enrichedData = await response.json();
      await onEnrich(enrichedData);

      setSuccess('MCP configuration processed successfully!');
      setMcpConfig('');
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON configuration');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to process MCP configuration');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="enrich-tab">
      <div className="enrich-header">
        <h3>Enrich RoleDef</h3>
        <p>Upload documents, URLs, or MCP configurations to automatically enhance your RoleDef</p>
      </div>

      <div className="enrich-tabs">
        <button
          className={`enrich-tab-btn ${activeUploadTab === 'document' ? 'active' : ''}`}
          onClick={() => setActiveUploadTab('document')}
        >
          📄 Document
        </button>
        <button
          className={`enrich-tab-btn ${activeUploadTab === 'url' ? 'active' : ''}`}
          onClick={() => setActiveUploadTab('url')}
        >
          🔗 URL
        </button>
        <button
          className={`enrich-tab-btn ${activeUploadTab === 'mcp' ? 'active' : ''}`}
          onClick={() => setActiveUploadTab('mcp')}
        >
          ⚙️ MCP Config
        </button>
      </div>

      {error && <div className="enrich-error">{error}</div>}
      {success && <div className="enrich-success">{success}</div>}

      <div className="enrich-content">
        {activeUploadTab === 'document' && (
          <div className="enrich-section">
            <h4>Upload Document</h4>
            <p>Upload resumes, job descriptions, or other documents to extract relevant information</p>
            <div className="file-upload">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt"
                id="file-input"
              />
              <label htmlFor="file-input" className="file-label">
                {selectedFile ? selectedFile.name : 'Choose a file...'}
              </label>
            </div>
            <button
              onClick={handleDocumentUpload}
              disabled={!selectedFile || isProcessing}
              className="btn-primary"
            >
              {isProcessing ? 'Processing...' : 'Upload and Process'}
            </button>
          </div>
        )}

        {activeUploadTab === 'url' && (
          <div className="enrich-section">
            <h4>Add from URL</h4>
            <p>Provide a URL to documentation or resources to extract information</p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/documentation"
              className="url-input"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!url.trim() || isProcessing}
              className="btn-primary"
            >
              {isProcessing ? 'Processing...' : 'Fetch and Process'}
            </button>
          </div>
        )}

        {activeUploadTab === 'mcp' && (
          <div className="enrich-section">
            <h4>MCP Configuration</h4>
            <p>Paste MCP (Model Context Protocol) configuration to add tools and capabilities</p>
            <textarea
              value={mcpConfig}
              onChange={(e) => setMcpConfig(e.target.value)}
              placeholder='{\n  "name": "my-mcp-server",\n  "tools": [...]\n}'
              className="mcp-textarea"
              rows={10}
            />
            <button
              onClick={handleMcpSubmit}
              disabled={!mcpConfig.trim() || isProcessing}
              className="btn-primary"
            >
              {isProcessing ? 'Processing...' : 'Process Configuration'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
