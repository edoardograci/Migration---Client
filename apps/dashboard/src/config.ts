const ENV = import.meta.env;

export const config = {
    apiUrl: ENV.VITE_API_URL || 'http://localhost:3001',
    environment: ENV.MODE || 'development',
    isDevelopment: ENV.DEV,
    isProduction: ENV.PROD,
} as const;
