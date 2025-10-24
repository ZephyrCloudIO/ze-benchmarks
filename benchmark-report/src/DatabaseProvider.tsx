import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import initSqlJs, { Database } from 'sql.js';

interface DatabaseContextType {
  db: Database | null;
  isLoading: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  isLoading: true,
  error: null,
});

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

interface DatabaseProviderProps {
  children: ReactNode;
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children }) => {
  const [db, setDb] = useState<Database | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initDatabase = async () => {
      try {
        const SQL = await initSqlJs({
          locateFile: (file) => `/${file}`,
        });

        // Fetch the database file
        const response = await fetch('/benchmarks.db');
        if (!response.ok) {
          throw new Error(`Failed to load database: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Load the database from the file
        const database = new SQL.Database(uint8Array);
        setDb(database);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize database'));
        setIsLoading(false);
      }
    };

    initDatabase();

    // Cleanup function
    return () => {
      if (db) {
        db.close();
      }
    };
  }, []);

  return (
    <DatabaseContext.Provider value={{ db, isLoading, error }}>
      {children}
    </DatabaseContext.Provider>
  );
};
