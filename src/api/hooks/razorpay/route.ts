import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { completePaidCart, hasValidSignature } from "../../../lib/razorpay"

type OrderPaidEvent = {
  event?: string
  payload?: {
    order?: { entity?: { id?: string; notes?: { cart_id?: string } } }
    payment?: { entity?: { id?: string } }
  }
}

/**
 * POST /hooks/razorpay  (Razorpay webhook, event "order.paid")
 *
 * Backup for when a customer pays but closes the browser before the website
 * can confirm the order. Only active when RAZORPAY_WEBHOOK_SECRET is set.
 * The raw body is kept for the signature check (see src/api/middlewares.ts).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return res.status(404).json({ message: "Webhook not configured" })

  const raw = (req as MedusaRequest & { rawBody?: Buffer }).rawBody
  if (!raw || !hasValidSignature(raw, req.headers["x-razorpay-signature"], secret)) {
    return res.status(400).json({ message: "Invalid signature" })
  }

  const event = req.body as OrderPaidEvent
  const cartId = event.payload?.order?.entity?.notes?.cart_id
  const razorpayOrderId = event.payload?.order?.entity?.id
  const razorpayPaymentId = event.payload?.payment?.entity?.id
  if (event.event !== "order.paid" || !cartId || !razorpayOrderId || !razorpayPaymentId) {
    return res.json({ ignored: true })
  }

  try {
    const order = await completePaidCart(req.scope, { cartId, razorpayOrderId, razorpayPaymentId })
    res.json({ order: order.id })
  } catch (e) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`[razorpay webhook] ${razorpayPaymentId} for cart ${cartId}: ${(e as Error).message}`)
    // A non-2xx reply makes Razorpay retry later
    res.status(500).json({ message: "Could not place order" })
  }
}
