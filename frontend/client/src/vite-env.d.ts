/// <reference types="vite/client" />

// Vite 注入的 import.meta.env 类型。
// 前端只允许读 VITE_ 前缀的变量，且它们都是「构建期常量」——
// 需要运行时可改的配置，走后端的配置接口（数据库里的配置表），不要塞进这里。
interface ImportMetaEnv {
  /** 站点标题，用于 <title> 与 JSON-LD。留空则用代码里的默认值。 */
  readonly VITE_SITE_NAME?: string;
  /** 站点规范域名，用于 canonical / og:url。 */
  readonly VITE_SITE_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
