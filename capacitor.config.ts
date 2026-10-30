import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Permanent. The app's on-device storage is keyed to this id, so changing it
  // strands every installed copy's IndexedDB and localStorage, the same way
  // renaming the Worker in wrangler.jsonc would for the website.
  appId: 'dev.sallvain.mylove',
  appName: 'My Love',
  webDir: 'dist',
  plugins: {
    // Updates come from the Cloudflare site, not Capgo's cloud:
    // src/services/nativeUpdates.ts checks updates/latest.json and downloads
    // the bundle that scripts/package-live-update.sh published.
    CapacitorUpdater: {
      autoUpdate: false,
      // Off: by default the plugin reports device ids, crashes and JavaScript
      // errors to plugin.capgo.app, a service this app has no account with.
      statsUrl: '',
    },
  },
};

export default config;
