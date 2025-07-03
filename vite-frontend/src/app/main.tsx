import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';

const App = React.lazy(() => import('./App'));

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={null}>
          <App />
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
