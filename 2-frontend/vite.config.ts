import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const portal = loadEnv(mode, process.cwd(), '').VITE_COMPANY_PORTAL === 'true';
  const portalFiles: Record<string, string> = {
    './App.tsx': 'src/PortalApp.tsx',
    '../data/seedData': 'src/data/emptySeed.ts',
  };
  return {
    plugins: [
      react(), tailwindcss(),
      ...(portal ? [{
        name: 'company-portal-build',
        enforce: 'pre' as const,
        resolveId(source: string) {
          if (portalFiles[source]) return path.resolve(__dirname, portalFiles[source]);
        },
        generateBundle() {
          for (const id of this.getModuleIds()) {
            if (/\/data\/(seedData|flamingoAdapter|flamingo_seed_data)\./.test(id)) {
              this.error('Company build includes a demo data module.');
            }
          }
        },
      }] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
