/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Địa chỉ máy chủ CompetencyAI, vd https://competencyai-api.onrender.com (không có /api ở cuối) */
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
