import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSuggestedCriteria, createRoleDef } from '../api';
import { SuggestedCriteria } from '../types';
import '../styles/EvaluationCriteria.css';

interface CriteriaWithScore extends SuggestedCriteria {
  score: number;
  selected: boolean;
}

export default function EvaluationCriteria() {
  const navigate = useNavigate();
  const [criteria, setCriteria] = useState<CriteriaWithScore[]>([]);
  const [customCriteria, setCustomCriteria] = useState<Array<{ name: string; description: string; score: number; category: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // New custom criteria form
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
      // Get form data from previous step
      const formDataStr = sessionStorage.getItem('roleDefFormData');
      if (!formDataStr) {
        alert('Session expired. Please start over.');
        navigate('/create');
        return;
      }

      const formData = JSON.parse(formDataStr);

      // Get selected criteria
      const selectedCriteria = criteria.filter((c) => c.selected);

      if (selectedCriteria.length === 0 && customCriteria.length === 0) {
        alert('Please select or add at least one evaluation criteria');
        return;
      }

      setSubmitting(true);

      // Build RoleDef payload
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

      // Clear session storage
      sessionStorage.removeItem('roleDefFormData');

      // Navigate to detail page
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
    <div className="container">
      <header className="header">
        <h1 className="title">Evaluation Criteria</h1>
        <p className="subtitle">Step 2: Rate importance of each skill</p>
      </header>

      {loading && <div className="loading">Loading criteria...</div>}

      {error && <div className="error">{error}</div>}

      {!loading && (
        <>
          <div className="criteria-filters">
            <label htmlFor="category-filter">Filter by category:</label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="form-select"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="criteria-section">
            <h2 className="section-title">Suggested Criteria</h2>
            <p className="section-help">
              Select criteria and rate their importance (1-5)
            </p>

            <div className="criteria-list">
              {filteredCriteria.map((c, index) => {
                const actualIndex = criteria.findIndex((item) => item === c);
                return (
                  <div
                    key={actualIndex}
                    className={`criteria-item ${c.selected ? 'selected' : ''}`}
                  >
                    <div className="criteria-checkbox">
                      <input
                        type="checkbox"
                        id={`criteria-${actualIndex}`}
                        checked={c.selected}
                        onChange={() => toggleCriteria(actualIndex)}
                      />
                      <label htmlFor={`criteria-${actualIndex}`}>
                        <strong>{c.name}</strong>
                        <p className="criteria-description">{c.description}</p>
                        <span className="criteria-category">{c.category}</span>
                      </label>
                    </div>
                    {c.selected && (
                      <div className="criteria-score">
                        <label>Score:</label>
                        <div className="score-buttons">
                          {[1, 2, 3, 4, 5].map((score) => (
                            <button
                              key={score}
                              type="button"
                              className={`score-btn ${c.score === score ? 'active' : ''}`}
                              onClick={() => updateScore(actualIndex, score)}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="criteria-section">
            <h2 className="section-title">Custom Criteria</h2>
            <p className="section-help">Add your own evaluation criteria</p>

            <div className="custom-criteria-form">
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Criteria name"
                  value={newCriteria.name}
                  onChange={(e) =>
                    setNewCriteria({ ...newCriteria, name: e.target.value })
                  }
                  className="form-input"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newCriteria.description}
                  onChange={(e) =>
                    setNewCriteria({ ...newCriteria, description: e.target.value })
                  }
                  className="form-input"
                />
                <select
                  value={newCriteria.score}
                  onChange={(e) =>
                    setNewCriteria({
                      ...newCriteria,
                      score: Number.parseInt(e.target.value),
                    })
                  }
                  className="form-select"
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
                  className="btn btn-secondary"
                >
                  Add
                </button>
              </div>
            </div>

            {customCriteria.length > 0 && (
              <div className="custom-criteria-list">
                {customCriteria.map((c, index) => (
                  <div key={index} className="custom-criteria-item">
                    <div>
                      <strong>{c.name}</strong> - Score: {c.score}
                      {c.description && <p>{c.description}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomCriteria(index)}
                      className="btn-remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/create')}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary"
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
