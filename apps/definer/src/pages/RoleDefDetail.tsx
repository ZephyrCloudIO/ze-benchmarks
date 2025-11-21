import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchRoleDefById, deleteRoleDef } from '../api';
import { RoleDef } from '../types';
import '../styles/RoleDefDetail.css';

export default function RoleDefDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [roleDef, setRoleDef] = useState<RoleDef | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'persona' | 'capabilities' | 'criteria' | 'json'>('overview');

  useEffect(() => {
    if (id) {
      loadRoleDef();
    }
  }, [id]);

  async function loadRoleDef() {
    try {
      setLoading(true);
      const data = await fetchRoleDefById(id!);
      setRoleDef(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RoleDef');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this RoleDef?')) return;

    try {
      await deleteRoleDef(id!);
      navigate('/');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete RoleDef');
    }
  }

  function downloadJSON() {
    if (!roleDef) return;

    const jsonData = {
      schema_version: roleDef.schemaVersion,
      name: roleDef.name,
      displayName: roleDef.displayName,
      version: roleDef.version,
      license: roleDef.license,
      availability: roleDef.availability,
      maintainers: JSON.parse(roleDef.maintainers),
      persona: JSON.parse(roleDef.persona),
      capabilities: JSON.parse(roleDef.capabilities),
      dependencies: JSON.parse(roleDef.dependencies),
      documentation: JSON.parse(roleDef.documentation),
      preferred_models: JSON.parse(roleDef.preferredModels),
      prompts: JSON.parse(roleDef.prompts),
      spawnable_sub_agent_specialists: JSON.parse(roleDef.spawnableSubAgents),
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${roleDef.name}.jsonc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="container"><div className="loading">Loading...</div></div>;
  if (error) return <div className="container"><div className="error">{error}</div></div>;
  if (!roleDef) return <div className="container"><div className="error">RoleDef not found</div></div>;

  const persona = JSON.parse(roleDef.persona);
  const capabilities = JSON.parse(roleDef.capabilities);
  const dependencies = JSON.parse(roleDef.dependencies);
  const documentation = JSON.parse(roleDef.documentation);
  const preferredModels = JSON.parse(roleDef.preferredModels);
  const maintainers = JSON.parse(roleDef.maintainers);

  return (
    <div className="container">
      <div className="detail-header">
        <Link to="/" className="back-link">← Back to list</Link>
        <div className="detail-title-section">
          <h1 className="detail-title">{roleDef.displayName}</h1>
          <span className="detail-version">v{roleDef.version}</span>
        </div>
        <p className="detail-subtitle">{persona.purpose}</p>
        <div className="detail-actions">
          <button onClick={downloadJSON} className="btn btn-secondary">
            Download JSON
          </button>
          <button onClick={handleDelete} className="btn btn-danger">
            Delete
          </button>
        </div>
      </div>

      <div className="detail-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'persona' ? 'active' : ''}`}
          onClick={() => setActiveTab('persona')}
        >
          Persona
        </button>
        <button
          className={`tab ${activeTab === 'capabilities' ? 'active' : ''}`}
          onClick={() => setActiveTab('capabilities')}
        >
          Capabilities
        </button>
        <button
          className={`tab ${activeTab === 'criteria' ? 'active' : ''}`}
          onClick={() => setActiveTab('criteria')}
        >
          Evaluation Criteria
        </button>
        <button
          className={`tab ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveTab('json')}
        >
          JSON Preview
        </button>
      </div>

      <div className="detail-content">
        {activeTab === 'overview' && (
          <div className="detail-section">
            <div className="info-grid">
              <div className="info-item">
                <label>Name</label>
                <div>{roleDef.name}</div>
              </div>
              <div className="info-item">
                <label>Version</label>
                <div>{roleDef.version}</div>
              </div>
              <div className="info-item">
                <label>License</label>
                <div>{roleDef.license}</div>
              </div>
              <div className="info-item">
                <label>Availability</label>
                <div>{roleDef.availability}</div>
              </div>
              <div className="info-item">
                <label>Created</label>
                <div>{new Date(roleDef.createdAt).toLocaleString()}</div>
              </div>
              <div className="info-item">
                <label>Updated</label>
                <div>{new Date(roleDef.updatedAt).toLocaleString()}</div>
              </div>
            </div>

            <div className="subsection">
              <h3>Maintainers</h3>
              <div className="list">
                {maintainers.map((m: any, i: number) => (
                  <div key={i} className="list-item">
                    <strong>{m.name}</strong> - {m.email}
                  </div>
                ))}
              </div>
            </div>

            <div className="subsection">
              <h3>Preferred Models</h3>
              <div className="tags">
                {preferredModels.map((m: any, i: number) => (
                  <span key={i} className="tag">{m.model}</span>
                ))}
              </div>
            </div>

            {documentation.length > 0 && (
              <div className="subsection">
                <h3>Documentation</h3>
                <div className="list">
                  {documentation.map((doc: any, i: number) => (
                    <div key={i} className="list-item">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        {doc.description}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'persona' && (
          <div className="detail-section">
            <div className="subsection">
              <h3>Purpose</h3>
              <p>{persona.purpose}</p>
            </div>

            {persona.values && persona.values.length > 0 && (
              <div className="subsection">
                <h3>Values</h3>
                <ul className="list">
                  {persona.values.map((v: string, i: number) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            )}

            {persona.attributes && persona.attributes.length > 0 && (
              <div className="subsection">
                <h3>Attributes</h3>
                <ul className="list">
                  {persona.attributes.map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {persona.tech_stack && persona.tech_stack.length > 0 && (
              <div className="subsection">
                <h3>Tech Stack</h3>
                <div className="tags">
                  {persona.tech_stack.map((t: string, i: number) => (
                    <span key={i} className="tag">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'capabilities' && (
          <div className="detail-section">
            {capabilities.tags && capabilities.tags.length > 0 && (
              <div className="subsection">
                <h3>Tags</h3>
                <div className="tags">
                  {capabilities.tags.map((t: string, i: number) => (
                    <span key={i} className="tag">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {capabilities.descriptions && Object.keys(capabilities.descriptions).length > 0 && (
              <div className="subsection">
                <h3>Descriptions</h3>
                <div className="list">
                  {Object.entries(capabilities.descriptions).map(([key, value]: [string, any], i: number) => (
                    <div key={i} className="list-item">
                      <strong>{key}</strong>
                      <p>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {capabilities.considerations && capabilities.considerations.length > 0 && (
              <div className="subsection">
                <h3>Considerations</h3>
                <ul className="list">
                  {capabilities.considerations.map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="subsection">
              <h3>Dependencies</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Subscription Required</label>
                  <div>{dependencies.subscription?.required ? 'Yes' : 'No'}</div>
                </div>
                {dependencies.subscription?.purpose && (
                  <div className="info-item">
                    <label>Purpose</label>
                    <div>{dependencies.subscription.purpose}</div>
                  </div>
                )}
              </div>
              {dependencies.available_tools && dependencies.available_tools.length > 0 && (
                <div>
                  <label>Available Tools</label>
                  <div className="tags">
                    {dependencies.available_tools.map((t: string, i: number) => (
                      <span key={i} className="tag">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'criteria' && (
          <div className="detail-section">
            {roleDef.evaluationCriteria && roleDef.evaluationCriteria.length > 0 ? (
              <div className="criteria-display">
                {roleDef.evaluationCriteria.map((c, i) => (
                  <div key={i} className="criteria-card">
                    <div className="criteria-card-header">
                      <h4>{c.name}</h4>
                      <span className="criteria-score-badge">Score: {c.score}/5</span>
                    </div>
                    {c.description && <p>{c.description}</p>}
                    <div className="criteria-meta">
                      {c.category && <span className="tag">{c.category}</span>}
                      {c.isCustom && <span className="tag custom">Custom</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No evaluation criteria defined</p>
            )}
          </div>
        )}

        {activeTab === 'json' && (
          <div className="detail-section">
            <pre className="json-preview">
              {JSON.stringify({
                schema_version: roleDef.schemaVersion,
                name: roleDef.name,
                displayName: roleDef.displayName,
                version: roleDef.version,
                license: roleDef.license,
                availability: roleDef.availability,
                maintainers,
                persona,
                capabilities,
                dependencies,
                documentation,
                preferred_models: preferredModels,
              }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
