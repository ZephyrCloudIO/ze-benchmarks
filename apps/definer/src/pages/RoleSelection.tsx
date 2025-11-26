import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  cardPadded,
  inputBase,
  pageContainer,
  primaryButton,
  secondaryButton,
  textareaBase,
} from '../ui';

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
    <div className={pageContainer}>
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Define Your Role</h1>
        <p className="text-lg text-slate-600">Step 1: Basic Information</p>
      </header>

      <form onSubmit={handleSubmit} className={`${cardPadded} mx-auto max-w-3xl space-y-10`}>
        <div className="space-y-8">
          <h2 className="text-2xl font-semibold text-slate-900">Role Identity</h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-semibold text-slate-800">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., nextjs-specialist"
                className={inputBase}
                required
              />
              <p className="text-xs text-slate-500">Unique identifier (lowercase, hyphen-separated)</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-semibold text-slate-800">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                placeholder="e.g., Next.js Expert"
                className={inputBase}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="purpose" className="text-sm font-semibold text-slate-800">
                Purpose <span className="text-red-500">*</span>
              </label>
              <textarea
                id="purpose"
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                placeholder="Describe the main purpose and expertise of this role..."
                className={textareaBase}
                rows={4}
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl font-semibold text-slate-900">Maintainer Information</h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="maintainerName" className="text-sm font-semibold text-slate-800">
                Maintainer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="maintainerName"
                name="maintainerName"
                value={formData.maintainerName}
                onChange={handleChange}
                placeholder="Your name or team name"
                className={inputBase}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="maintainerEmail" className="text-sm font-semibold text-slate-800">
                Maintainer Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="maintainerEmail"
                name="maintainerEmail"
                value={formData.maintainerEmail}
                onChange={handleChange}
                placeholder="contact@example.com"
                className={inputBase}
                required
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate('/')}
            className={secondaryButton}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={primaryButton}
            disabled={!isValid}
          >
            Next: Evaluation Criteria
          </button>
        </div>
      </form>
    </div>
  );
}
