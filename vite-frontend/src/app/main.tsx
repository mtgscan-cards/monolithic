// src/app/main.tsx
import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

const App = React.lazy(() => import('./App'));
import { AuthProvider } from '../contexts/AuthContext';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <div style={{ display: 'none' }}>Loading...</div>
        <Suspense fallback={null}>
          <App />
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);