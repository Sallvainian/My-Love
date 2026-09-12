import { defineConfig, mergeConfig } from 'vite';
import appConfig from '../../../../vite.config';

// Verification only: serve the former UTF-16 comparisons without editing src/.
export default defineConfig(async (environment) => {
  const base = typeof appConfig === 'function' ? await appConfig(environment) : await appConfig;
  return mergeConfig(base, {
    plugins: [{
      name: 'dw83-former-utf16-validation',
      enforce: 'pre',
      transform(source: string, id: string) {
        if (!id.split('?')[0].endsWith('/src/components/Settings/EventsSettings.tsx')) return;
        const comparisons = ['trimmedLabel', 'trimmedDescription'];
        let modified = source;
        for (const name of comparisons) {
          const original = `[...${name}].length`;
          if (modified.split(original).length !== 2) {
            throw new Error(`DW83 probe expected one ${original} comparison`);
          }
          modified = modified.replace(original, `${name}.length`);
        }
        process.stdout.write('DW83 probe applied both former UTF-16 comparisons\n');
        return { code: modified, map: null };
      },
    }],
  });
});
