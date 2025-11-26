import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRoleDefs } from '../api';
import { RoleDef } from '../types';
import { cardPadded, pageContainer, primaryButton, secondaryButton } from '../ui';

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
    <div className={pageContainer}>
      <header className="space-y-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">RoleDef Builder</h1>
        <p className="text-lg text-slate-600">Create and manage AI agent role definitions</p>
      </header>

      <div className="flex justify-center">
        <Link to="/create" className={primaryButton}>
          Start building RoleDef
        </Link>
      </div>

      <section className={`${cardPadded} space-y-6`}>
        <h2 className="text-2xl font-semibold text-slate-900">Your RoleDefs</h2>

        {loading && <div className="py-10 text-center text-slate-500">Loading RoleDefs...</div>}

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="flex-1">{error}</p>
            <button onClick={loadRoleDefs} className={secondaryButton}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && roleDefs.length === 0 && (
          <div className="py-10 text-center text-slate-500">
            <p>No RoleDefs yet. Create your first one!</p>
          </div>
        )}

        {!loading && !error && roleDefs.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {roleDefs.map((roleDef) => {
              const persona = JSON.parse(roleDef.persona);
              return (
                <Link
                  key={roleDef.id}
                  to={`/roledef/${roleDef.id}`}
                  className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-500 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{roleDef.displayName}</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      v{roleDef.version}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{persona.purpose}</p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                    <span>Created {new Date(roleDef.createdAt).toLocaleDateString()}</span>
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
