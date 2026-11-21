import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * POST /store/newsletter  { email }
 *
 * Newsletter sign-up from the website footer. Subscribers are stored as
 * customers with metadata.newsletter = true, so they show up in the admin
 * under Customers (no separate email service needed yet). An existing
 * customer with the same email is marked as subscribed instead.
 */
export async function POST(req: MedusaRequest<{ email?: unknown }>, res: MedusaResponse) {
  const email = String(req.body?.email ?? "").trim().toLowerCase()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address." })
  }

  const customers = req.scope.resolve(Modules.CUSTOMER)
  const subscribed = { newsletter: true, newsletter_subscribed_at: new Date().toISOString() }

  const [existing] = await customers.listCustomers({ email }, { take: 1 })
  if (!existing) {
    await customers.createCustomers({ email, metadata: subscribed })
  } else if (!existing.metadata?.newsletter) {
    await customers.updateCustomers(existing.id, {
      metadata: { ...(existing.metadata ?? {}), ...subscribed },
    })
  }

  res.json({ subscribed: true })
}
