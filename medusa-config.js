const { loadEnv, defineConfig } = require("@medusajs/framework/utils");

loadEnv(process.env.NODE_ENV || "development", process.cwd());

// Patch pg global defaults so ALL connections (including per-module
// migrations that create their own pools) use SSL without cert verification.
// databaseDriverOptions alone only covers Medusa's main connection.
const pg = require("pg");
pg.defaults.ssl = { rejectUnauthorized: false };

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: { ssl: { rejectUnauthorized: false } },
    redisUrl: process.env.REDIS_URL,
    http: {
      port: parseInt(process.env.PORT || "9000"),
      storeCors: process.env.STORE_CORS,
      adminCors: process.env.ADMIN_CORS,
      authCors: process.env.AUTH_CORS,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    disable: false,
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
  },
  modules: [
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/fulfillment-manual",
            id: "manual",
          },
        ],
      },
    },
    ...(process.env.STRIPE_API_KEY
      ? [
          {
            resolve: "@medusajs/medusa/payment",
            options: {
              providers: [
                {
                  resolve: "@medusajs/payment-stripe",
                  id: "stripe",
                  options: {
                    apiKey: process.env.STRIPE_API_KEY,
                  },
                },
              ],
            },
          },
        ]
      : []),
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/file-local",
            id: "local",
            options: {
              upload_dir: "static",
              backend_url: `${
                process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
              }/static`,
            },
          },
        ],
      },
    },
  ],
});
