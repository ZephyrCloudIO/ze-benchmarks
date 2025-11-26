import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchRoleDefById, deleteRoleDef, updateRoleDef } from '../api';
import { RoleDef } from '../types';
import EditableField from '../components/EditableField';
import EditableList from '../components/EditableList';
import EnrichTab from '../components/EnrichTab';
import {
  card,
  cardPadded,
  dangerButton,
  pageContainer,
  primaryButton,
  secondaryButton,
  tag,
  tagPrimary,
} from '../ui';

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

    const updated = { ...roleDef };

    if (enrichedData.persona) {
      const currentPersona = JSON.parse(updated.persona);
      updated.persona = JSON.stringify({ ...currentPersona, ...enrichedData.persona });
    }

    if (enrichedData.capabilities) {
      const currentCapabilities = JSON.parse(updated.capabilities);
      updated.capabilities = JSON.stringify({ ...currentCapabilities, ...enrichedData.capabilities });
    }

    if (enrichedData.documentation) {
      const currentDocs = JSON.parse(updated.documentation);
      updated.documentation = JSON.stringify([...currentDocs, ...enrichedData.documentation]);
    }

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

    try {
      await updateRoleDef(id!, updated);
    } catch (err) {
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

  if (loading) return <div className={pageContainer}><div className="py-10 text-center text-slate-500">Loading...</div></div>;
  if (error) return <div className={pageContainer}><div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div></div>;
  if (!roleDef) return <div className={pageContainer}><div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">RoleDef not found</div></div>;

  const persona = JSON.parse(roleDef.persona);
  const capabilities = JSON.parse(roleDef.capabilities);
  const dependencies = JSON.parse(roleDef.dependencies);
  const documentation = JSON.parse(roleDef.documentation);
  const preferredModels = JSON.parse(roleDef.preferredModels);
  const maintainers = JSON.parse(roleDef.maintainers);

  const tabButton =
    'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition';

  return (
    <div className={pageContainer}>
      <div className="space-y-4">
        <Link to="/" className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700">
          ← Back to list
        </Link>
        <div className={`${card} space-y-3 p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">{roleDef.displayName}</h1>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                v{roleDef.version}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {isEditing ? (
                <>
                  <button onClick={handleSave} disabled={isSaving} className={primaryButton}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      loadRoleDef();
                    }}
                    className={secondaryButton}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsEditing(true)} className={primaryButton}>
                    Edit
                  </button>
                  <button onClick={downloadJSON} className={secondaryButton}>
                    Download JSON
                  </button>
                  <button onClick={handleDelete} className={dangerButton}>
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="text-slate-600">{persona.purpose}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-full border border-slate-200 bg-white p-2 shadow-sm">
        <button
          className={`${tabButton} ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`${tabButton} ${activeTab === 'persona' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          onClick={() => setActiveTab('persona')}
        >
          Persona
        </button>
        <button
          className={`${tabButton} ${activeTab === 'capabilities' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          onClick={() => setActiveTab('capabilities')}
        >
          Capabilities
        </button>
        <button
          className={`${tabButton} ${activeTab === 'criteria' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          onClick={() => setActiveTab('criteria')}
        >
          Evaluation Criteria
        </button>
        <button
          className={`${tabButton} ${activeTab === 'enrich' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          onClick={() => setActiveTab('enrich')}
        >
          Enrich
        </button>
        <button
          className={`${tabButton} ${activeTab === 'json' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          onClick={() => setActiveTab('json')}
        >
          JSON Preview
        </button>
      </div>

      <div className={cardPadded}>
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <EditableField
                label="Name"
                value={roleDef.name}
                onSave={(v) => updateField('name', v)}
              />
              <EditableField
                label="Display Name"
                value={roleDef.displayName}
                onSave={(v) => updateField('displayName', v)}
              />
              <EditableField
                label="Version"
                value={roleDef.version}
                onSave={(v) => updateField('version', v)}
              />
              <EditableField
                label="License"
                value={roleDef.license}
                onSave={(v) => updateField('license', v)}
              />
              <EditableField
                label="Availability"
                value={roleDef.availability}
                onSave={(v) => updateField('availability', v)}
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-800">Created</p>
                <p className="text-sm text-slate-700">{new Date(roleDef.createdAt).toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-800">Updated</p>
                <p className="text-sm text-slate-700">{new Date(roleDef.updatedAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">Maintainers</h3>
              <div className="space-y-3">
                {maintainers.map((m: any, i: number) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-2">
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

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Preferred Models</h3>
              <div className="flex flex-wrap gap-2">
                {preferredModels.map((m: any, i: number) => (
                  <span key={i} className={tag}>{m.model}</span>
                ))}
              </div>
            </div>

            {documentation.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-900">Documentation</h3>
                <div className="space-y-2">
                  {documentation.map((doc: any, i: number) => (
                    <a
                      key={i}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-blue-700 hover:border-blue-300 hover:bg-white"
                    >
                      {doc.description}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'persona' && (
          <div className="space-y-6">
            <EditableField
              label="Purpose"
              value={persona.purpose}
              multiline
              onSave={(v) => updatePersonaField('purpose', v)}
            />

            <EditableList
              label="Values"
              items={persona.values || []}
              onUpdate={(items) => updatePersonaField('values', items)}
            />

            <EditableList
              label="Attributes"
              items={persona.attributes || []}
              onUpdate={(items) => updatePersonaField('attributes', items)}
            />

            <EditableList
              label="Tech Stack"
              items={persona.tech_stack || []}
              onUpdate={(items) => updatePersonaField('tech_stack', items)}
            />
          </div>
        )}

        {activeTab === 'capabilities' && (
          <div className="space-y-6">
            <EditableList
              label="Tags"
              items={capabilities.tags || []}
              onUpdate={(items) => updateCapabilitiesField('tags', items)}
            />

            {capabilities.descriptions && Object.keys(capabilities.descriptions).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-900">Descriptions</h3>
                <div className="space-y-3">
                  {Object.entries(capabilities.descriptions).map(([key, value]: [string, any], i: number) => (
                    <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <strong className="text-sm text-slate-800">{key}</strong>
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

            <EditableList
              label="Considerations"
              items={capabilities.considerations || []}
              onUpdate={(items) => updateCapabilitiesField('considerations', items)}
            />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">Dependencies</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">Subscription Required</p>
                  <p className="text-sm text-slate-700">{dependencies.subscription?.required ? 'Yes' : 'No'}</p>
                </div>
                {dependencies.subscription?.purpose && (
                  <EditableField
                    label="Purpose"
                    value={dependencies.subscription.purpose}
                    onSave={(v) => {
                      const deps = JSON.parse(roleDef.dependencies);
                      deps.subscription.purpose = v;
                      updateField('dependencies', JSON.stringify(deps));
                    }}
                  />
                )}
              </div>
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
        )}

        {activeTab === 'criteria' && (
          <div className="space-y-4">
            {roleDef.evaluationCriteria && roleDef.evaluationCriteria.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {roleDef.evaluationCriteria.map((c, i) => (
                  <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-lg font-semibold text-slate-900">{c.name}</h4>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Score: {c.score}/5</span>
                    </div>
                    {c.description && <p className="text-sm leading-6 text-slate-700">{c.description}</p>}
                    <div className="flex flex-wrap gap-2">
                      {c.category && <span className={tag}>{c.category}</span>}
                      {c.isCustom && <span className={tagPrimary}>Custom</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600">No evaluation criteria defined</p>
            )}
          </div>
        )}

        {activeTab === 'enrich' && (
          <EnrichTab onEnrich={handleEnrich} />
        )}

        {activeTab === 'json' && (
          <div className="space-y-3">
            <pre className="max-h-[640px] overflow-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
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
