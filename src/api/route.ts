import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * The backend has no home page of its own. Send anyone who opens the bare
 * domain to the admin dashboard instead of showing "Cannot GET /".
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.redirect(302, "/app")
}
