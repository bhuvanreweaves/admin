import Medusa from "@medusajs/js-sdk"

// The admin is served by the same server as the API, so "/" reaches the
// backend both locally (localhost:9000) and live (admin.bhuvanreweaves.com).
export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
  debug: false,
  auth: { type: "session" },
})
