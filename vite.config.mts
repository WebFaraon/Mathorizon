import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';

/* Mathorizon — build config for the React "island" that renders the
   Capitole page body.

   This is NOT a single-page-app build. The site stays a set of static
   .html pages served by server.js (and by whatever static host runs
   production); only capitole.html's content below the shared navbar is
   React. So there is no index.html entry here — the entry is the .tsx
   module itself, and the emitted JS/CSS are linked from capitole.html by
   scripts/sync-react-tags.js (run automatically by `npm run build:react`,
   which reads the manifest below and rewrites the tags in-place).

   Output goes to assets/react/ — inside the already-served static asset
   tree, and COMMITTED to git: production has no build step, it just serves
   the repo's files. Filenames are content-hashed, which is why the tags in
   capitole.html are generated rather than hand-written.

   The build script is deliberately named `build:react`, not `build`: a
   plain `build` script is what static hosts auto-detect and start running
   on deploy, which would silently change how this live site is published.
*/
/* Rewrites the generated <link>/<script> tags in capitole.html to point at
   the filenames this build just emitted. See scripts/sync-react-tags.js. */
function syncCapitoleTags(): Plugin {
  return {
    name: 'mathorizon:sync-capitole-tags',
    // writeBundle, not closeBundle: in watch mode closeBundle doesn't fire
    // between rebuilds, so the page would keep pointing at the first hash.
    writeBundle() {
      execFileSync(process.execPath, ['scripts/sync-react-tags.js'], { stdio: 'inherit' });
    }
  };
}

export default defineConfig({
  base: '/assets/react/',
  plugins: [react(), syncCapitoleTags()],
  build: {
    outDir: 'assets/react',
    emptyOutDir: true,
    manifest: true,
    // Everything the island needs is bundled; the page loads no other
    // module, so a single chunk is both simpler and one less request.
    rollupOptions: {
      // Relative to the project root, so this config stays valid whether Vite
      // loads it as ESM or CJS (package.json is "type": "commonjs").
      input: 'src/capitole/main.tsx',
      output: {
        entryFileNames: 'capitole-[hash].js',
        assetFileNames: 'capitole-[hash][extname]'
      }
    }
  }
});
