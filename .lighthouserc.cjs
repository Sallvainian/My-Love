// Lighthouse CI configuration
// NFR-P3: Initial feature load < 2s on 3G; skeleton loading states
// Runs against production build served via `vite preview`

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx vite preview --port 9222',
      startServerReadyPattern: 'Local:',
      url: ['http://localhost:9222/My-Love/'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        // NFR-P3: < 2s on 3G (Lighthouse default mobile throttling)
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        interactive: ['warn', { maxNumericValue: 5000 }],
        'categories:performance': ['warn', { minScore: 0.7 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
