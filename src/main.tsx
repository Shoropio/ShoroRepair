import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { initializeData } from './offline/db';
import { runScheduledActivityCleanup } from './utils/activity/activityUtils';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import './styles/index.css';
import './i18n';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');

initializeData().then(() => {
  runScheduledActivityCleanup().catch(() => {});
  setInterval(() => { runScheduledActivityCleanup().catch(() => {}); }, 86400000);
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <Toaster position="top-right" richColors closeButton />
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}).catch(err => {
  console.error('Initialization failed:', err);
  const div = document.createElement('div');
  div.style.padding = '20px';
  div.style.color = 'red';
  div.textContent = `Error al iniciar: ${err?.message ?? err}`;
  rootElement.appendChild(div);
});
