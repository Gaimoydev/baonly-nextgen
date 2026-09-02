/// <reference types="vite/client" />

// Vite 注入的 import.meta.env 类型。
// 后台的配置一律来自后端接口（数据库里的配置表），构建期常量应当极少。
interface ImportMetaEnv {
  /** 后台标题栏文案。 */
  readonly VITE_DASHBOARD_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
