import type { AppConfig } from '../app/core/config/app-config';

export const environment: AppConfig = {
  production: true,
  apiBaseUrl: '/api',
  auth: {
    attachToken: true,
  },
  latency: {
    enabled: false,
    delayMs: 0,
  },
};
