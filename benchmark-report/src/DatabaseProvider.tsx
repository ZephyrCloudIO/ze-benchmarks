import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import initSqlJs, { type Database } from 'sql.js';

interface DatabaseContextType {
  db: Database | null;
  isLoading: boolean;
  error: Error | null;
  refreshDatabase: () => Promise<void>;
  isRefreshing: boolean;
  lastRefreshed: Date | null;
}

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  isLoading: true,
  error: null,
  refreshDatabase: async () => {},
  isRefreshing: false,
  lastRefreshed: null,
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [lastKnownTimestamp, setLastKnownTimestamp] = useState<number>(0);

  const loadDatabase = async () => {
    try {
      const SQL = await initSqlJs({
        locateFile: (file) => `/${file}`,
      });

      // Fetch the database file with simple cache busting
      const response = await fetch(`/benchmarks.db?t=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load database: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Load the database from the file
      const database = new SQL.Database(uint8Array);
      
      // Close existing database if any
      if (db) {
        db.close();
      }
      
      setDb(database);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load database'));
    }
  };

  const refreshDatabase = async () => {
    setIsRefreshing(true);
    try {
      await loadDatabase();
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const initDatabase = async () => {
      try {
        await loadDatabase();
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize database'));
        setIsLoading(false);
      }
    };

    initDatabase();

    // Polling mechanism for database updates
    const checkForUpdates = async () => {
      try {
        const response = await fetch(`/db-version.json?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.lastModified > lastKnownTimestamp) {
            setLastKnownTimestamp(data.lastModified);
            if (lastKnownTimestamp > 0) { // Skip first load
              await refreshDatabase();
            }
          }
        }
      } catch (err) {
        // Silently ignore errors
      }
    };

    const interval = setInterval(checkForUpdates, 5000);
    return () => {
      clearInterval(interval);
      if (db) {
        db.close();
      }
    };
  }, [lastKnownTimestamp]);

  return (
    <DatabaseContext.Provider value={{ db, isLoading, error, refreshDatabase, isRefreshing, lastRefreshed }}>
      {children}
    </DatabaseContext.Provider>
  );
};
