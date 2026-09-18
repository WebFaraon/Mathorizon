import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

/* Entry point of the Capitole island. Mounted into #root in capitole.html,
   which is the only element on that page React owns — see App.tsx.

   This is a module script, so it runs after every classic <script> on the
   page (data.js, storage.js, utils.js, auth.js …) has executed, and
   therefore after window.BM exists. It does NOT wait for the Supabase sync;
   that arrives later, as events — see hooks/useCapitoleData.ts. */
const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  console.error('[capitole] #root not found — React island not mounted.');
}
