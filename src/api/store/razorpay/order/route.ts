import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  addShippingMethodToCartWorkflow,
  listShippingOptionsForCartWorkflow,
  updateCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { razorpay, razorpayKeys, toPaise } from "../../../../lib/razorpay"

type Body = {
  cart_id?: unknown
  customer?: Record<string, unknown>
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function text(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max)
}

/**
 * POST /store/razorpay/order  { cart_id, customer: { name, email, phone,
 *   address_1, address_2?, city, province, postal_code } }
 *
 * Saves the customer's contact and delivery details on the cart, adds free
 * shipping, and creates a Razorpay order for the cart total. The website
 * opens Razorpay's checkout with the returned order.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const cartId = text(req.body?.cart_id, 100)
  const c = req.body?.customer ?? {}
  const name = text(c.name, 100)
  const email = text(c.email, 254).toLowerCase()
  const phone = text(c.phone, 20).replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, "")
  const address_1 = text(c.address_1)
  const address_2 = text(c.address_2)
  const city = text(c.city, 100)
  const province = text(c.province, 100)
  const postal_code = text(c.postal_code, 10)

  const problems = [
    !cartId && "cart",
    name.length < 2 && "name",
    !EMAIL.test(email) && "email",
    !/^[6-9]\d{9}$/.test(phone) && "10-digit mobile number",
    !address_1 && "address",
    !city && "city",
    !province && "state",
    !/^\d{6}$/.test(postal_code) && "6-digit PIN code",
  ].filter(Boolean)
  if (problems.length) {
    return res.status(400).json({ message: `Please check your ${problems.join(", ")}.` })
  }

  const { keyId } = razorpayKeys()
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const loadCart = async () =>
    (
      await query.graph({
        entity: "cart",
        fields: ["id", "completed_at", "total", "currency_code", "metadata", "items.id", "shipping_methods.id"],
        filters: { id: cartId },
      })
    ).data[0]

  let cart = await loadCart()
  if (!cart || cart.completed_at) {
    return res.status(404).json({ message: "Your cart has expired. Please add the items again." })
  }
  if (!cart.items?.length) {
    return res.status(400).json({ message: "Your cart is empty." })
  }

  const [first_name, ...rest] = name.split(/\s+/)
  const address = {
    first_name,
    last_name: rest.join(" "),
    phone: `+91${phone}`,
    address_1,
    address_2,
    city,
    province,
    postal_code,
    country_code: "in",
  }
  await updateCartWorkflow(req.scope).run({
    input: { id: cart.id, email, shipping_address: address, billing_address: address },
  })

  if (!cart.shipping_methods?.length) {
    const { result: options } = await listShippingOptionsForCartWorkflow(req.scope).run({
      input: { cart_id: cart.id, is_return: false },
    })
    if (!options?.length) {
      return res.status(503).json({ message: "Online checkout isn't available right now. Please order on WhatsApp." })
    }
    await addShippingMethodToCartWorkflow(req.scope).run({
      input: { cart_id: cart.id, options: [{ id: options[0].id }] },
    })
  }

  cart = await loadCart()
  const amount = toPaise(cart!.total)
  if (!(amount >= 100)) {
    return res.status(400).json({ message: "The order total must be at least ₹1." })
  }

  const order = await razorpay<{ id: string; amount: number; currency: string }>("/orders", {
    method: "POST",
    body: { amount, currency: "INR", receipt: cart!.id.slice(0, 40), notes: { cart_id: cart!.id } },
  })

  await req.scope.resolve(Modules.CART).updateCarts(cart!.id, {
    metadata: { ...(cart!.metadata ?? {}), razorpay_order_id: order.id },
  })

  res.json({
    key_id: keyId,
    razorpay_order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    prefill: { name, email, contact: `+91${phone}` },
  })
}
