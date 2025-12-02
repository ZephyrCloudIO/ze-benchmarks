/// <reference types="@rsbuild/core/types" />

interface ImportMetaEnv {
  readonly ZE_PUBLIC_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
