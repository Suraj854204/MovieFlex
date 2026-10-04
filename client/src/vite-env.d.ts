/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** Backend origin for REST calls, e.g. https://api.example.com. Empty = same origin / dev proxy. */
  readonly VITE_API_URL?: string;
  /** Socket.IO origin. Defaults to VITE_API_URL. */
  readonly VITE_SOCKET_URL?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
