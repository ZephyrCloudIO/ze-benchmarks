import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSuggestedCriteria, createRoleDef } from '../api';
import { SuggestedCriteria } from '../types';
import {
  card,
  cardPadded,
  inputBase,
  pageContainer,
  primaryButton,
  secondaryButton,
  selectBase,
} from '../ui';

interface CriteriaWithScore extends SuggestedCriteria {
  score: number;
  selected: boolean;
}

const scoreButtonBase =
  'h-10 w-10 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800 transition hover:border-blue-500 hover:text-blue-600';
const scoreButtonActive = 'bg-blue-600 text-white border-blue-600 shadow-sm';

export default function EvaluationCriteria() {
  const navigate = useNavigate();
  const [criteria, setCriteria] = useState<CriteriaWithScore[]>([]);
  const [customCriteria, setCustomCriteria] = useState<Array<{ name: string; description: string; score: number; category: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [newCriteria, setNewCriteria] = useState({ name: '', description: '', score: 3, category: 'custom' });

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'technical', label: 'Technical Skills' },
    { value: 'communication', label: 'Communication' },
    { value: 'architecture', label: 'Architecture & Design' },
    { value: 'devops', label: 'DevOps & Tools' },
    { value: 'soft-skills', label: 'Soft Skills' },
    { value: 'domain', label: 'Domain Specific' },
  ];

  useEffect(() => {
    loadCriteria();
  }, []);

  async function loadCriteria() {
    try {
      setLoading(true);
      const data = await fetchSuggestedCriteria('general', 'all');
      setCriteria(
        data.criteria.map((c) => ({
          ...c,
          score: c.defaultScore,
          selected: false,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load criteria');
    } finally {
      setLoading(false);
    }
  }

  function toggleCriteria(index: number) {
    setCriteria((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
    );
  }

  function updateScore(index: number, score: number) {
    setCriteria((prev) =>
      prev.map((c, i) => (i === index ? { ...c, score } : c))
    );
  }

  function addCustomCriteria() {
    if (!newCriteria.name) return;

    setCustomCriteria((prev) => [...prev, { ...newCriteria }]);
    setNewCriteria({ name: '', description: '', score: 3, category: 'custom' });
  }

  function removeCustomCriteria(index: number) {
    setCustomCriteria((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    try {
      const formDataStr = sessionStorage.getItem('roleDefFormData');
      if (!formDataStr) {
        alert('Session expired. Please start over.');
        navigate('/create');
        return;
      }

      const formData = JSON.parse(formDataStr);
      const selectedCriteria = criteria.filter((c) => c.selected);

      if (selectedCriteria.length === 0 && customCriteria.length === 0) {
        alert('Please select or add at least one evaluation criteria');
        return;
      }

      setSubmitting(true);

      const roleDefData = {
        name: formData.name,
        displayName: formData.displayName,
        version: '1.0.0',
        schemaVersion: '0.0.1',
        license: 'MIT',
        availability: 'public',
        maintainers: [
          {
            name: formData.maintainerName,
            email: formData.maintainerEmail,
          },
        ],
        persona: {
          purpose: formData.purpose,
          values: [],
          attributes: [],
          tech_stack: [],
        },
        capabilities: {
          tags: [],
          descriptions: {},
          considerations: [],
        },
        dependencies: {
          subscription: {
            required: false,
            purpose: 'No subscription required',
          },
          available_tools: ['file_system', 'terminal', 'code_analysis', 'git'],
          mcps: [],
        },
        documentation: [],
        preferredModels: [{ model: 'claude-sonnet-4.5' }],
        prompts: {
          default: {
            spawnerPrompt: `I'm a ${formData.displayName}. ${formData.purpose}`,
          },
        },
        spawnableSubAgents: [],
        evaluationCriteria: [
          ...selectedCriteria.map((c) => ({
            name: c.name,
            description: c.description,
            score: c.score,
            category: c.category,
            isCustom: false,
          })),
          ...customCriteria.map((c) => ({
            name: c.name,
            description: c.description,
            score: c.score,
            category: c.category,
            isCustom: true,
          })),
        ],
      };

      const result = await createRoleDef(roleDefData);
      sessionStorage.removeItem('roleDefFormData');
      navigate(`/roledef/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create RoleDef');
      setSubmitting(false);
    }
  }

  const filteredCriteria =
    selectedCategory === 'all'
      ? criteria
      : criteria.filter((c) => c.category === selectedCategory);

  return (
    <div className={pageContainer}>
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Evaluation Criteria</h1>
        <p className="text-lg text-slate-600">Step 2: Rate importance of each skill</p>
      </header>

      {loading && <div className="py-10 text-center text-slate-500">Loading criteria...</div>}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

      {!loading && (
        <>
          <div className={`${card} flex flex-wrap items-center gap-3 px-5 py-4`}>
            <label htmlFor="category-filter" className="text-sm font-semibold text-slate-800">
              Filter by category:
            </label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`${selectBase} w-auto min-w-[220px]`}
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className={`${cardPadded} space-y-4`}>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">Suggested Criteria</h2>
              <p className="text-sm text-slate-600">
                Select criteria and rate their importance (1-5)
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {filteredCriteria.map((c, index) => {
                const actualIndex = criteria.findIndex((item) => item === c);
                const selected = c.selected;
                return (
                  <div
                    key={actualIndex}
                    className={`rounded-xl border p-6 shadow-sm transition ${
                      selected
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                        : 'border-slate-200 bg-white hover:border-blue-200'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-3">
                        <input
                          type="checkbox"
                          id={`criteria-${actualIndex}`}
                          checked={c.selected}
                          onChange={() => toggleCriteria(actualIndex)}
                          className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
                        />
                        <label htmlFor={`criteria-${actualIndex}`} className="space-y-2">
                          <strong className="block text-base text-slate-900">{c.name}</strong>
                          <p className="text-sm text-slate-600">{c.description}</p>
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            {c.category}
                          </span>
                        </label>
                      </div>
                      {selected && (
                        <div className="mt-2 flex items-center gap-3 md:mt-0">
                          <span className="text-sm font-semibold text-slate-800">Score:</span>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((score) => (
                              <button
                                key={score}
                                type="button"
                                className={`${scoreButtonBase} ${c.score === score ? scoreButtonActive : ''}`}
                                onClick={() => updateScore(actualIndex, score)}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${cardPadded} space-y-4`}>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900">Custom Criteria</h2>
              <p className="text-sm text-slate-600">Add your own evaluation criteria</p>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:[grid-template-columns:1.1fr_1.1fr_auto_auto]">
                <input
                  type="text"
                  placeholder="Criteria name"
                  value={newCriteria.name}
                  onChange={(e) =>
                    setNewCriteria({ ...newCriteria, name: e.target.value })
                  }
                  className={inputBase}
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newCriteria.description}
                  onChange={(e) =>
                    setNewCriteria({ ...newCriteria, description: e.target.value })
                  }
                  className={inputBase}
                />
                <select
                  value={newCriteria.score}
                  onChange={(e) =>
                    setNewCriteria({
                      ...newCriteria,
                      score: Number.parseInt(e.target.value),
                    })
                  }
                  className={selectBase}
                >
                  {[1, 2, 3, 4, 5].map((score) => (
                    <option key={score} value={score}>
                      Score: {score}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addCustomCriteria}
                  className={secondaryButton}
                >
                  Add
                </button>
              </div>
            </div>

            {customCriteria.length > 0 && (
              <div className="flex flex-col gap-3">
                {customCriteria.map((c, index) => (
                  <div key={index} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-sm text-slate-800">
                      <strong>{c.name}</strong> - Score: {c.score}
                      {c.description && <p className="text-slate-600">{c.description}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomCriteria(index)}
                      className="rounded-full p-2 text-red-500 transition hover:bg-red-50 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate('/create')}
              className={secondaryButton}
              disabled={submitting}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className={primaryButton}
              disabled={submitting}
            >
              {submitting ? 'Building...' : 'Build RoleDef'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
