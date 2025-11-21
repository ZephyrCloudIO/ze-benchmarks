import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchRoleDefById, deleteRoleDef, updateRoleDef } from '../api';
import { RoleDef } from '../types';
import EditableField from '../components/EditableField';
import EditableList from '../components/EditableList';
import EnrichTab from '../components/EnrichTab';
import '../styles/RoleDefDetail.css';

export default function RoleDefDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [roleDef, setRoleDef] = useState<RoleDef | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'persona' | 'capabilities' | 'criteria' | 'enrich' | 'json'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  async function handleSave() {
    if (!roleDef) return;

    setIsSaving(true);
    try {
      await updateRoleDef(id!, roleDef);
      await loadRoleDef();
      setIsEditing(false);
      alert('RoleDef saved successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save RoleDef');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEnrich(enrichedData: any) {
    if (!roleDef) return;

    // Merge enriched data with existing roleDef
    const updated = { ...roleDef };

    // Update persona if provided
    if (enrichedData.persona) {
      const currentPersona = JSON.parse(updated.persona);
      updated.persona = JSON.stringify({ ...currentPersona, ...enrichedData.persona });
    }

    // Update capabilities if provided
    if (enrichedData.capabilities) {
      const currentCapabilities = JSON.parse(updated.capabilities);
      updated.capabilities = JSON.stringify({ ...currentCapabilities, ...enrichedData.capabilities });
    }

    // Update documentation if provided
    if (enrichedData.documentation) {
      const currentDocs = JSON.parse(updated.documentation);
      updated.documentation = JSON.stringify([...currentDocs, ...enrichedData.documentation]);
    }

    // Update dependencies if provided
    if (enrichedData.dependencies) {
      const currentDeps = JSON.parse(updated.dependencies);
      updated.dependencies = JSON.stringify({ ...currentDeps, ...enrichedData.dependencies });
    }

    setRoleDef(updated);
    await updateRoleDef(id!, updated);
    await loadRoleDef();
  }

  async function updateField(field: keyof RoleDef, value: any) {
    if (!roleDef) return;
    const updated = { ...roleDef, [field]: value };
    setRoleDef(updated);

    // Auto-save to server
    try {
      console.log('Saving field:', field, 'value:', value);
      const result = await updateRoleDef(id!, updated);
      console.log('Save result:', result);
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save changes: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function updatePersonaField(field: string, value: any) {
    if (!roleDef) return;
    const persona = JSON.parse(roleDef.persona);
    persona[field] = value;
    await updateField('persona', JSON.stringify(persona));
  }

  async function updateCapabilitiesField(field: string, value: any) {
    if (!roleDef) return;
    const capabilities = JSON.parse(roleDef.capabilities);
    capabilities[field] = value;
    await updateField('capabilities', JSON.stringify(capabilities));
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
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => {
                setIsEditing(false);
                loadRoleDef();
              }} className="btn btn-secondary">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(true)} className="btn btn-primary">
                Edit
              </button>
              <button onClick={downloadJSON} className="btn btn-secondary">
                Download JSON
              </button>
              <button onClick={handleDelete} className="btn btn-danger">
                Delete
              </button>
            </>
          )}
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
          className={`tab ${activeTab === 'enrich' ? 'active' : ''}`}
          onClick={() => setActiveTab('enrich')}
        >
          Enrich
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
                <EditableField
                  label="Name"
                  value={roleDef.name}
                  onSave={(v) => updateField('name', v)}
                />
              </div>
              <div className="info-item">
                <EditableField
                  label="Display Name"
                  value={roleDef.displayName}
                  onSave={(v) => updateField('displayName', v)}
                />
              </div>
              <div className="info-item">
                <EditableField
                  label="Version"
                  value={roleDef.version}
                  onSave={(v) => updateField('version', v)}
                />
              </div>
              <div className="info-item">
                <EditableField
                  label="License"
                  value={roleDef.license}
                  onSave={(v) => updateField('license', v)}
                />
              </div>
              <div className="info-item">
                <EditableField
                  label="Availability"
                  value={roleDef.availability}
                  onSave={(v) => updateField('availability', v)}
                />
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
                    <EditableField
                      label="Name"
                      value={m.name}
                      onSave={(v) => {
                        const updated = [...maintainers];
                        updated[i].name = v;
                        updateField('maintainers', JSON.stringify(updated));
                      }}
                    />
                    <EditableField
                      label="Email"
                      value={m.email}
                      onSave={(v) => {
                        const updated = [...maintainers];
                        updated[i].email = v;
                        updateField('maintainers', JSON.stringify(updated));
                      }}
                    />
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
              <EditableField
                label="Purpose"
                value={persona.purpose}
                multiline
                onSave={(v) => updatePersonaField('purpose', v)}
              />
            </div>

            <div className="subsection">
              <EditableList
                label="Values"
                items={persona.values || []}
                onUpdate={(items) => updatePersonaField('values', items)}
              />
            </div>

            <div className="subsection">
              <EditableList
                label="Attributes"
                items={persona.attributes || []}
                onUpdate={(items) => updatePersonaField('attributes', items)}
              />
            </div>

            <div className="subsection">
              <EditableList
                label="Tech Stack"
                items={persona.tech_stack || []}
                onUpdate={(items) => updatePersonaField('tech_stack', items)}
              />
            </div>
          </div>
        )}

        {activeTab === 'capabilities' && (
          <div className="detail-section">
            <div className="subsection">
              <EditableList
                label="Tags"
                items={capabilities.tags || []}
                onUpdate={(items) => updateCapabilitiesField('tags', items)}
              />
            </div>

            {capabilities.descriptions && Object.keys(capabilities.descriptions).length > 0 && (
              <div className="subsection">
                <h3>Descriptions</h3>
                <div className="list">
                  {Object.entries(capabilities.descriptions).map(([key, value]: [string, any], i: number) => (
                    <div key={i} className="list-item">
                      <strong>{key}</strong>
                      <EditableField
                        value={value}
                        multiline
                        onSave={(v) => {
                          const updated = { ...capabilities.descriptions };
                          updated[key] = v;
                          updateCapabilitiesField('descriptions', updated);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="subsection">
              <EditableList
                label="Considerations"
                items={capabilities.considerations || []}
                onUpdate={(items) => updateCapabilitiesField('considerations', items)}
              />
            </div>

            <div className="subsection">
              <h3>Dependencies</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Subscription Required</label>
                  <div>{dependencies.subscription?.required ? 'Yes' : 'No'}</div>
                </div>
                {dependencies.subscription?.purpose && (
                  <div className="info-item">
                    <EditableField
                      label="Purpose"
                      value={dependencies.subscription.purpose}
                      onSave={(v) => {
                        const deps = JSON.parse(roleDef.dependencies);
                        deps.subscription.purpose = v;
                        updateField('dependencies', JSON.stringify(deps));
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="subsection">
                <EditableList
                  label="Available Tools"
                  items={dependencies.available_tools || []}
                  onUpdate={(items) => {
                    const deps = JSON.parse(roleDef.dependencies);
                    deps.available_tools = items;
                    updateField('dependencies', JSON.stringify(deps));
                  }}
                />
              </div>
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

        {activeTab === 'enrich' && (
          <EnrichTab onEnrich={handleEnrich} />
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
