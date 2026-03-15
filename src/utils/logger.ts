/* eslint-disable no-console */
const isDev = import.meta.env.DEV;

export const logger = {
  /** DEV only — verbose tracing, flow debugging */
  debug: (...args: unknown[]): void => {
    if (isDev) console.debug(...args);
  },
  /** Always logs — operational events (sync completed, subscribed, etc.) */
  info: (...args: unknown[]): void => {
    console.info(...args);
  },
  /** Always logs — general purpose */
  log: (...args: unknown[]): void => {
    console.log(...args);
  },
};
