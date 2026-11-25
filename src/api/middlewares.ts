import { defineMiddlewares } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      // Razorpay signs the exact bytes it sends, so keep the raw body
      matcher: "/hooks/razorpay",
      method: ["POST"],
      bodyParser: { preserveRawBody: true },
    },
  ],
})
