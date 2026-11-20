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
    // Branding, logo and extra product fields (see admin-customizations.js).
    // Only called while building the admin, so the production server, which
    // runs from .medusa/server, never loads that file.
    vite: () => require("./admin-customizations").viteConfig(),
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
      // Files (product images): Cloudflare R2 when S3_* settings are present,
      // otherwise the local "static" folder (fine for development only).
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          process.env.S3_BUCKET
            ? {
                resolve: "@medusajs/file-s3",
                id: "s3",
                options: {
                  file_url: process.env.S3_FILE_URL,
                  access_key_id: process.env.S3_ACCESS_KEY_ID,
                  secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                  region: process.env.S3_REGION || "auto",
                  bucket: process.env.S3_BUCKET,
                  endpoint: process.env.S3_ENDPOINT,
                  additional_client_config: { forcePathStyle: true },
                },
              }
            : {
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
