// playwright-utils deviation: these Node SDK/reporting tests have no browser
// responses. The installed auto monitor depends on page even when opted out.
// Keep the existing merged entry point; override only this suite's browser hook.
// A separate variable also accommodates the installed merge's omitted hook type.
export const nodeOnlyFixtures = {
  authSessionEnabled: false,
  // eslint-disable-next-line no-empty-pattern -- Playwright requires destructured fixture dependencies.
  networkErrorMonitor: async ({}, provide: () => Promise<void>) => {
    await provide();
  },
};
