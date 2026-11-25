import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * One-time setup so carts can become orders (needed for online payment):
 * a stock location in India, linked to the store's sales channel, with a
 * "Free shipping" option for all of India.
 *
 * Run with:  npx medusa exec ./src/scripts/setup-checkout.ts
 * Safe to run again: anything that already exists is reused.
 */
const LOCATION_NAME = "Bhuvan Reweaves Studio"
const SHIPPING_NAME = "Free shipping"
const FULFILLMENT_PROVIDER = "manual_manual"

export default async function setupCheckout({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillment = container.resolve(Modules.FULFILLMENT)

  const { data: existingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id"],
    filters: { name: SHIPPING_NAME },
  })
  if (existingOptions.length) {
    logger.info(`"${SHIPPING_NAME}" already exists, nothing to do.`)
    return
  }

  const { data: regions } = await query.graph({ entity: "region", fields: ["id"], filters: { currency_code: "inr" } })
  const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id", "name"] })
  const { data: profiles } = await query.graph({ entity: "shipping_profile", fields: ["id", "type"] })
  const region = regions[0]
  const profile = profiles.find((p) => p.type === "default") ?? profiles[0]
  if (!region || !channels.length || !profile) {
    throw new Error("Needs an INR region, a sales channel and a shipping profile first.")
  }

  // Stock location
  let { data: [location] } = await query.graph({
    entity: "stock_location",
    fields: ["id", "fulfillment_sets.id", "fulfillment_sets.service_zones.id"],
    filters: { name: LOCATION_NAME },
  })
  if (!location) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: LOCATION_NAME,
            address: {
              address_1: "9E, Krishna Nagar Extension",
              city: "Gobichettipalayam",
              province: "Tamil Nadu",
              postal_code: "638452",
              country_code: "IN",
            },
          },
        ],
      },
    })
    location = { ...result[0], fulfillment_sets: [] } as typeof location
    logger.info(`Created stock location "${LOCATION_NAME}".`)

    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add: channels.map((c) => c.id) },
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: FULFILLMENT_PROVIDER },
    })
  }

  // Fulfillment set with an "India" service zone
  let serviceZoneId = location.fulfillment_sets?.[0]?.service_zones?.[0]?.id
  if (!serviceZoneId) {
    const set = await fulfillment.createFulfillmentSets({
      name: `${LOCATION_NAME} shipping`,
      type: "shipping",
      service_zones: [{ name: "India", geo_zones: [{ country_code: "in", type: "country" }] }],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
    })
    serviceZoneId = set.service_zones[0].id
  }

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: SHIPPING_NAME,
        price_type: "flat",
        provider_id: FULFILLMENT_PROVIDER,
        service_zone_id: serviceZoneId,
        shipping_profile_id: profile.id,
        type: { label: "Free", description: "Free shipping across India", code: "free" },
        prices: [
          { currency_code: "inr", amount: 0 },
          { region_id: region.id, amount: 0 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })
  logger.info(`Created "${SHIPPING_NAME}" for India. Checkout is ready.`)
}
