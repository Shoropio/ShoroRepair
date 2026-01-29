import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { initializeData } from './offline/db';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import './styles/index.css';
import './i18n';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');

initializeData().then(() => {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}).catch(err => {
  console.error('Initialization failed:', err);
  rootElement.innerHTML = `<div style="padding: 20px; color: red;">Error al iniciar: ${err.message}</div>`;
});
