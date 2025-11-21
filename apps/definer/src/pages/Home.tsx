import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRoleDefs } from '../api';
import { RoleDef } from '../types';
import '../styles/Home.css';

export default function Home() {
  const [roleDefs, setRoleDefs] = useState<RoleDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoleDefs();
  }, []);

  async function loadRoleDefs() {
    try {
      setLoading(true);
      const data = await fetchRoleDefs();
      setRoleDefs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RoleDefs');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">RoleDef Builder</h1>
        <p className="subtitle">Create and manage AI agent role definitions</p>
      </header>

      <div className="action-section">
        <Link to="/create" className="btn btn-primary">
          Start building RoleDef
        </Link>
      </div>

      <section className="roledef-list-section">
        <h2 className="section-title">Your RoleDefs</h2>

        {loading && (
          <div className="loading">Loading RoleDefs...</div>
        )}

        {error && (
          <div className="error">
            <p>{error}</p>
            <button onClick={loadRoleDefs} className="btn btn-secondary">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && roleDefs.length === 0 && (
          <div className="empty-state">
            <p>No RoleDefs yet. Create your first one!</p>
          </div>
        )}

        {!loading && !error && roleDefs.length > 0 && (
          <div className="roledef-grid">
            {roleDefs.map((roleDef) => {
              const persona = JSON.parse(roleDef.persona);
              return (
                <Link
                  key={roleDef.id}
                  to={`/roledef/${roleDef.id}`}
                  className="roledef-card"
                >
                  <div className="roledef-card-header">
                    <h3 className="roledef-card-title">{roleDef.displayName}</h3>
                    <span className="roledef-card-version">v{roleDef.version}</span>
                  </div>
                  <p className="roledef-card-purpose">{persona.purpose}</p>
                  <div className="roledef-card-meta">
                    <span className="meta-item">
                      Created {new Date(roleDef.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
