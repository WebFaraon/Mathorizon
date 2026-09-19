import type { BMGlobal, BMAuthGlobal } from './lib/bm-types';

declare global {
  interface Window {
    /** Set up by js/data.js, js/storage.js, js/utils.js et al. — see lib/bm-types.ts. */
    BM?: BMGlobal;
    /** Set up by js/auth.js — see lib/bm-types.ts. */
    BMAuth?: BMAuthGlobal;
  }
}
