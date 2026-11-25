import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { completePaidCart, hasValidSignature, razorpayKeys } from "../../../../lib/razorpay"

type Body = {
  cart_id?: unknown
  razorpay_order_id?: unknown
  razorpay_payment_id?: unknown
  razorpay_signature?: unknown
}

/**
 * POST /store/razorpay/verify
 *   { cart_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Called by the website after the customer pays in Razorpay's popup. Checks
 * Razorpay's signature and the payment itself, then places the order.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const cartId = String(req.body?.cart_id ?? "")
  const razorpayOrderId = String(req.body?.razorpay_order_id ?? "")
  const razorpayPaymentId = String(req.body?.razorpay_payment_id ?? "")
  const { keySecret } = razorpayKeys()

  if (
    !cartId ||
    !hasValidSignature(`${razorpayOrderId}|${razorpayPaymentId}`, req.body?.razorpay_signature, keySecret)
  ) {
    return res.status(400).json({ message: "We couldn't verify this payment." })
  }

  const order = await completePaidCart(req.scope, { cartId, razorpayOrderId, razorpayPaymentId })
  res.json({ order })
}
