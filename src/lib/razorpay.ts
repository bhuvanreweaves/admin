import crypto from "crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  capturePaymentWorkflow,
  completeCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Razorpay checkout for Bhuvan Reweaves.
 *
 * Flow: the website asks /store/razorpay/order for a Razorpay order, the
 * customer pays in Razorpay's popup, and /store/razorpay/verify (or the
 * /hooks/razorpay webhook if the browser was closed) checks the payment with
 * Razorpay and turns the cart into a Medusa order, marked as paid.
 *
 * Inside Medusa the payment is recorded with the built-in "system" provider;
 * the Razorpay payment and order IDs are saved on the order's metadata.
 */

const API = "https://api.razorpay.com/v1"
/** Medusa's built-in provider, used to record the payment Razorpay took */
const MEDUSA_PROVIDER = "pp_system_default"

export function razorpayKeys() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Online payment is not set up yet.")
  }
  return { keyId, keySecret }
}

export async function razorpay<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { keyId, keySecret } = razorpayKeys()
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    const reason = data?.error?.description || `Razorpay request failed (${res.status})`
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, reason)
  }
  return data as T
}

/** Constant-time check of a hex HMAC-SHA256 signature */
export function hasValidSignature(payload: string | Buffer, signature: unknown, secret: string) {
  if (typeof signature !== "string" || !signature) return false
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Rupees (Medusa) → paise (Razorpay) */
export function toPaise(amount: unknown) {
  return Math.round(Number(amount) * 100)
}

type RazorpayPayment = {
  id: string
  order_id: string
  amount: number
  currency: string
  status: "created" | "authorized" | "captured" | "refunded" | "failed"
  method?: string
}

export type PaidCart = {
  id: string
  completed_at: string | null
  total: number
  metadata: Record<string, unknown> | null
  payment_collection?: {
    id: string
    payment_sessions?: { provider_id: string }[]
  } | null
}

/**
 * Checks a Razorpay payment for this cart and, if it is paid in full, turns
 * the cart into an order (or returns the order it already became).
 * Safe to call more than once for the same payment.
 */
export async function completePaidCart(
  container: MedusaContainer,
  { cartId, razorpayOrderId, razorpayPaymentId }: { cartId: string; razorpayOrderId: string; razorpayPaymentId: string }
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [cart],
  } = (await query.graph({
    entity: "cart",
    fields: [
      "id",
      "completed_at",
      "total",
      "metadata",
      "payment_collection.id",
      "payment_collection.payment_sessions.provider_id",
    ],
    filters: { id: cartId },
  })) as unknown as { data: PaidCart[] }

  if (!cart) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found.")
  if (cart.metadata?.razorpay_order_id !== razorpayOrderId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "This payment does not belong to this cart.")
  }

  // Ask Razorpay what was actually paid; never trust the browser for this
  let payment = await razorpay<RazorpayPayment>(`/payments/${encodeURIComponent(razorpayPaymentId)}`)
  if (payment.order_id !== razorpayOrderId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "This payment does not belong to this cart.")
  }
  if (payment.status === "authorized") {
    payment = await razorpay<RazorpayPayment>(`/payments/${payment.id}/capture`, {
      method: "POST",
      body: { amount: payment.amount, currency: payment.currency },
    })
  }
  if (payment.status !== "captured") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Payment is ${payment.status}, not completed.`)
  }

  return placeOrder(container, cart, razorpayOrderId, payment)
}

/** Turns a cart that Razorpay has been paid for into a paid Medusa order */
export async function placeOrder(
  container: MedusaContainer,
  cart: PaidCart,
  razorpayOrderId: string,
  payment: Pick<RazorpayPayment, "id" | "amount" | "method">
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  if (!cart.completed_at) {
    // The cart must not have changed since the customer paid
    if (payment.amount !== toPaise(cart.total)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "The amount paid does not match the cart total. Please contact us with your payment ID."
      )
    }

    let collectionId = cart.payment_collection?.id
    if (!collectionId) {
      const { result } = await createPaymentCollectionForCartWorkflow(container).run({ input: { cart_id: cart.id } })
      collectionId = result.id
    }
    const hasSession = cart.payment_collection?.payment_sessions?.some((s) => s.provider_id === MEDUSA_PROVIDER)
    if (!hasSession) {
      await createPaymentSessionsWorkflow(container).run({
        input: {
          payment_collection_id: collectionId,
          provider_id: MEDUSA_PROVIDER,
          data: { razorpay_order_id: razorpayOrderId, razorpay_payment_id: payment.id },
        },
      })
    }
  }

  // Returns the existing order if the cart was already completed
  const {
    result: { id: orderId },
  } = await completeCartWorkflow(container).run({ input: { id: cart.id } })

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata", "payment_collections.payments.id", "payment_collections.payments.captured_at"],
    filters: { id: orderId },
  })

  if (order.metadata?.razorpay_payment_id !== payment.id) {
    await container.resolve(Modules.ORDER).updateOrders(order.id, {
      metadata: {
        ...(order.metadata ?? {}),
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: payment.id,
        razorpay_method: payment.method ?? null,
      },
    })
  }

  // Razorpay already has the money, so show the order as paid in the admin
  for (const collection of order.payment_collections ?? []) {
    for (const p of collection?.payments ?? []) {
      if (p && !p.captured_at) {
        await capturePaymentWorkflow(container).run({ input: { payment_id: p.id } })
      }
    }
  }

  return { id: order.id, display_id: order.display_id as number }
}
