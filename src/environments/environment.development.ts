import type { AppConfig } from '../app/core/config/app-config';

export const environment: AppConfig = {
  production: false,
  apiBaseUrl: '/api',
  auth: {
    attachToken: true,
  },
  latency: {
    enabled: true,
    delayMs: 800,
  },
};
