// `process` minimal pour les dépendances pensées pour Node (process.cwd(), process.env.DEBUG…).
// `browser: true` empêche TypeScript de se croire sous Node (il chargerait alors `os`, `fs`…).
export const process = { browser: true, env: {}, cwd: () => "/", platform: "browser", version: "", versions: {}, nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)) };
