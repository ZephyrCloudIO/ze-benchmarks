import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { DatabaseProvider } from './DatabaseProvider';
import './index.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <DatabaseProvider>
        <RouterProvider router={router} />
      </DatabaseProvider>
    </React.StrictMode>,
  );
}
