// @ts-nocheck
import {
  ExecArgs,
  IProductModuleService,
  IRegionModuleService,
  ISalesChannelModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export default async function seed({ container }: ExecArgs) {
  const productModule: IProductModuleService = container.resolve(Modules.PRODUCT);
  const regionModule: IRegionModuleService = container.resolve(Modules.REGION);
  const salesChannelModule: ISalesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);

  console.log("Seeding Bhuvan Reweaves data...");

  // Create sales channel if not exists
  const existingChannels = await salesChannelModule.listSalesChannels({ name: "Online Store" });
  if (existingChannels.length === 0) {
    await salesChannelModule.createSalesChannels([{ name: "Online Store" }]);
    console.log("✓ Sales channel created");
  } else {
    console.log("✓ Sales channel already exists");
  }

  // Create India region if not exists
  const existingRegions = await regionModule.listRegions({ name: "India" });
  if (existingRegions.length === 0) {
    await regionModule.createRegions([
      { name: "India", currency_code: "inr", countries: ["in"] },
    ]);
    console.log("✓ India region created");
  } else {
    console.log("✓ India region already exists");
  }

  // Create tags first
  const tags = await productModule.createProductTags([
    { value: "formal-shirts" },
    { value: "cotton" },
    { value: "long-kurtas" },
    { value: "block-print" },
  ]);
  const tagMap = Object.fromEntries(tags.map((t) => [t.value, t.id]));
  console.log("✓ Tags created");

  const products = await productModule.createProducts([
    {
      title: "Handloom Cotton Formal Shirt",
      handle: "handloom-cotton-formal-shirt",
      description:
        "A refined formal shirt woven from handloom cotton. Understated elegance for the modern professional.",
      status: "published",
      options: [
        { title: "Size", values: ["XS", "S", "M", "L", "XL", "XXL"] },
      ],
      variants: [
        { title: "S", sku: "HCFS-S", options: { Size: "S" }, manage_inventory: true },
        { title: "M", sku: "HCFS-M", options: { Size: "M" }, manage_inventory: true },
        { title: "L", sku: "HCFS-L", options: { Size: "L" }, manage_inventory: true },
        { title: "XL", sku: "HCFS-XL", options: { Size: "XL" }, manage_inventory: true },
      ],
      tags: [{ id: tagMap["formal-shirts"] }, { id: tagMap["cotton"] }],
    },
    {
      title: "Indigo Block Print Kurta",
      handle: "indigo-block-print-kurta",
      description:
        "Hand block-printed with natural indigo dye on fine cotton. A statement piece rooted in tradition.",
      status: "published",
      options: [
        { title: "Size", values: ["XS", "S", "M", "L", "XL", "XXL"] },
      ],
      variants: [
        { title: "S", sku: "IBPK-S", options: { Size: "S" }, manage_inventory: true },
        { title: "M", sku: "IBPK-M", options: { Size: "M" }, manage_inventory: true },
        { title: "L", sku: "IBPK-L", options: { Size: "L" }, manage_inventory: true },
        { title: "XL", sku: "IBPK-XL", options: { Size: "XL" }, manage_inventory: true },
      ],
      tags: [{ id: tagMap["long-kurtas"] }, { id: tagMap["block-print"] }],
    },
  ]);

  console.log(`✓ ${products.length} products created`);
  console.log("Seeding complete.");
}
