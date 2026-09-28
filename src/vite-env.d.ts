/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** API do OpenDriver (app de corridas), ex.: https://api-app.opendriver.com.br */
  readonly VITE_OPENDRIVER_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
