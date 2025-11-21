import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/RoleSelection.css';

export default function RoleSelection() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    purpose: '',
    maintainerName: '',
    maintainerEmail: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Store form data in sessionStorage to use in next step
    sessionStorage.setItem('roleDefFormData', JSON.stringify(formData));
    navigate('/create/criteria');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const isValid = formData.name && formData.displayName && formData.purpose &&
    formData.maintainerName && formData.maintainerEmail;

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">Define Your Role</h1>
        <p className="subtitle">Step 1: Basic Information</p>
      </header>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-section">
          <h2 className="form-section-title">Role Identity</h2>

          <div className="form-group">
            <label htmlFor="name" className="form-label">
              Role Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., nextjs-specialist"
              className="form-input"
              required
            />
            <p className="form-help">Unique identifier (lowercase, hyphen-separated)</p>
          </div>

          <div className="form-group">
            <label htmlFor="displayName" className="form-label">
              Display Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="e.g., Next.js Expert"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="purpose" className="form-label">
              Purpose <span className="required">*</span>
            </label>
            <textarea
              id="purpose"
              name="purpose"
              value={formData.purpose}
              onChange={handleChange}
              placeholder="Describe the main purpose and expertise of this role..."
              className="form-textarea"
              rows={4}
              required
            />
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section-title">Maintainer Information</h2>

          <div className="form-group">
            <label htmlFor="maintainerName" className="form-label">
              Maintainer Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="maintainerName"
              name="maintainerName"
              value={formData.maintainerName}
              onChange={handleChange}
              placeholder="Your name or team name"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="maintainerEmail" className="form-label">
              Maintainer Email <span className="required">*</span>
            </label>
            <input
              type="email"
              id="maintainerEmail"
              name="maintainerEmail"
              value={formData.maintainerEmail}
              onChange={handleChange}
              placeholder="contact@example.com"
              className="form-input"
              required
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isValid}
          >
            Next: Evaluation Criteria
          </button>
        </div>
      </form>
    </div>
  );
}
