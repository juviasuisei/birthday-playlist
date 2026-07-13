import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';

/**
 * Vite plugin that fails the build if the VITE_AIRTABLE_API_TOKEN
 * environment variable is not set or is empty.
 * Validates: Requirements 11.1, 11.3
 */
function envTokenGuardPlugin(): Plugin {
  return {
    name: 'env-token-guard',
    config(_config, env) {
      // Only enforce during production build, not during dev/test
      if (env.command === 'build') {
        // Load env files the same way Vite does
        const loadedEnv = loadEnv(env.mode, process.cwd(), '');
        const token = loadedEnv.VITE_AIRTABLE_API_TOKEN ?? process.env.VITE_AIRTABLE_API_TOKEN;
        if (!token || token.trim() === '') {
          throw new Error(
            '[env-token-guard] Build failed: VITE_AIRTABLE_API_TOKEN environment variable is required but not set. ' +
            'Please set this variable in your .env file or environment before building.'
          );
        }
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [envTokenGuardPlugin()],
});
