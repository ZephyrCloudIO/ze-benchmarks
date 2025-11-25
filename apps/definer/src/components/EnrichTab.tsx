import { useState } from 'react';
import { cardPadded, inputBase, primaryButton, textareaBase } from '../ui';

interface EnrichTabProps {
  onEnrich: (data: any) => Promise<void>;
}

const tabButtonBase =
  'inline-flex items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-semibold transition hover:bg-slate-50';

export default function EnrichTab({ onEnrich }: EnrichTabProps) {
  const [activeUploadTab, setActiveUploadTab] = useState<'document' | 'url' | 'mcp'>('document');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
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
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-slate-900">Enrich RoleDef</h3>
        <p className="text-sm text-slate-600">Upload documents, URLs, or MCP configurations to automatically enhance your RoleDef</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          className={`${tabButtonBase} ${activeUploadTab === 'document' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'text-slate-600'}`}
          onClick={() => setActiveUploadTab('document')}
        >
          📄 Document
        </button>
        <button
          className={`${tabButtonBase} ${activeUploadTab === 'url' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'text-slate-600'}`}
          onClick={() => setActiveUploadTab('url')}
        >
          🔗 URL
        </button>
        <button
          className={`${tabButtonBase} ${activeUploadTab === 'mcp' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'text-slate-600'}`}
          onClick={() => setActiveUploadTab('mcp')}
        >
          ⚙️ MCP Config
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <div className={`${cardPadded} space-y-6`}>
        {activeUploadTab === 'document' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-semibold text-slate-900">Upload Document</h4>
              <p className="text-sm text-slate-600">Upload resumes, job descriptions, or other documents to extract relevant information</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt"
                id="file-input"
                className="sr-only"
              />
              <label
                htmlFor="file-input"
                className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-blue-500 hover:text-blue-600"
              >
                {selectedFile ? selectedFile.name : 'Choose a file...'}
              </label>
            </div>
            <button
              onClick={handleDocumentUpload}
              disabled={!selectedFile || isProcessing}
              className={primaryButton}
            >
              {isProcessing ? 'Processing...' : 'Upload and Process'}
            </button>
          </div>
        )}

        {activeUploadTab === 'url' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-semibold text-slate-900">Add from URL</h4>
              <p className="text-sm text-slate-600">Provide a URL to documentation or resources to extract information</p>
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/documentation"
              className={inputBase}
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!url.trim() || isProcessing}
              className={primaryButton}
            >
              {isProcessing ? 'Processing...' : 'Fetch and Process'}
            </button>
          </div>
        )}

        {activeUploadTab === 'mcp' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-lg font-semibold text-slate-900">MCP Configuration</h4>
              <p className="text-sm text-slate-600">Paste MCP (Model Context Protocol) configuration to add tools and capabilities</p>
            </div>
            <textarea
              value={mcpConfig}
              onChange={(e) => setMcpConfig(e.target.value)}
              placeholder='{\n  "name": "my-mcp-server",\n  "tools": [...]\n}'
              className={`${textareaBase} font-mono`}
              rows={10}
            />
            <button
              onClick={handleMcpSubmit}
              disabled={!mcpConfig.trim() || isProcessing}
              className={primaryButton}
            >
              {isProcessing ? 'Processing...' : 'Process Configuration'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
