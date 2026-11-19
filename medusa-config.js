const { loadEnv, defineConfig } = require("@medusajs/framework/utils");

loadEnv(process.env.NODE_ENV || "development", process.cwd());

// Patch pg global defaults so ALL connections (including per-module
// migrations that create their own pools) use SSL without cert verification.
// databaseDriverOptions alone only covers Medusa's main connection.
const pg = require("pg");
pg.defaults.ssl = { rejectUnauthorized: false };

// Admin dashboard branding: tab title "Bhuvan Reweaves Admin" and light theme
// by default. The theme default only applies until someone picks a theme in
// the user menu (Medusa stores that choice under "medusa_admin_theme").
const ADMIN_TITLE = "Bhuvan Reweaves Admin";
const adminBrandingHead = `
    <title>${ADMIN_TITLE}</title>
    <script>
      (function () {
        try {
          if (!localStorage.getItem("medusa_admin_theme")) {
            localStorage.setItem("medusa_admin_theme", "light");
          }
        } catch (e) {}
        try {
          var native = Object.getOwnPropertyDescriptor(Document.prototype, "title");
          Object.defineProperty(document, "title", {
            configurable: true,
            get: function () { return native.get.call(this); },
            set: function () { native.set.call(this, ${JSON.stringify(ADMIN_TITLE)}); },
          });
        } catch (e) {}
      })();
    </script>`;

const adminBrandingPlugin = {
  name: "bhuvan-admin-branding",
  transformIndexHtml(html) {
    return html.replace(/<head>/i, `<head>${adminBrandingHead}`);
  },
};

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
    // Merged into Medusa's own Vite config, so return only the additions
    vite: () => ({ plugins: [adminBrandingPlugin] }),
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
