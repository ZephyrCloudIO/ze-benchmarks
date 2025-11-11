import React, { type ReactNode, useState, useEffect, createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initDatabase, reloadDatabase, type Database } from '@/lib/database';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface DatabaseContextType {
  db: Database | null;
  isLoading: boolean;
  error: Error | null;
  refreshDatabase: () => Promise<void>;
  isRefreshing: boolean;
}

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  isLoading: true,
  error: null,
  refreshDatabase: async () => {},
  isRefreshing: false,
});

interface DatabaseProviderProps {
  children: ReactNode;
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children }) => {
  const [db, setDb] = useState<Database | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDatabase = async () => {
    try {
      setError(null);
      const database = await initDatabase();
      setDb(database);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load database'));
      console.error('Database loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDatabase = async () => {
    setIsRefreshing(true);
    try {
      await reloadDatabase();
      await loadDatabase();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh database'));
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <DatabaseContext.Provider value={{ db, isLoading, error, refreshDatabase, isRefreshing }}>
        {children}
      </DatabaseContext.Provider>
    </QueryClientProvider>
  );
};

export const useDatabase = () => useContext(DatabaseContext);
