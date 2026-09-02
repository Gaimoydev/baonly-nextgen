// process.env 的类型声明。
//
// 配置原则（见 docs/WORKLOG.md「配置系统要重构」）：只有【极敏感】或
// 【运行时必需、无法自举】的项进 .env，其余全部进数据库的配置表，后台可改、热生效。
// 上一代 .env 有 150+ 个变量，配置成本极高 —— 这份声明就是那条线的守门人。
//
// 往这里加变量前先自问：它能不能放进数据库？能就别放这里。

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: "development" | "production" | "test";
    PORT?: string;

    /** PostgreSQL 连接串。Prisma Migrate 经 prisma.config.ts 读它，运行时经 adapter 注入。 */
    DATABASE_URL: string;
    /** Redis 连接串。session / 限流 / presence / 缓存全部落这里，不用进程内 Map。 */
    REDIS_URL: string;

    // ── 凭据类：同样不入库 ──
    CPP_ACCOUNT?: string;
    CPP_PASSWORD?: string;
    WXPUSHER_APP_TOKEN?: string;
    SCDN_TOKEN?: string;
  }
}
