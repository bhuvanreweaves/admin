import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../lib/sdk"

/**
 * Extra product information for Bhuvan Reweaves.
 *
 * "Description" is Medusa's own product description. Everything else is
 * saved in the product's metadata (stored in the Supabase "product" table),
 * which the website already reads, e.g. metadata.fabric.
 */
type Field = { key: string; label: string; multiline?: boolean }

const SHORT_DESCRIPTION: Field = {
  key: "short_description",
  label: "Short description",
  multiline: true,
}

// Keep in sync with DETAIL_FIELDS in admin-customizations.js (create form)
const DETAIL_FIELDS: Field[] = [
  { key: "product_code", label: "Product Code" },
  { key: "fabric", label: "Fabric" },
  { key: "fit", label: "Fit" },
  { key: "color", label: "Color" },
  { key: "collar", label: "Collar" },
  { key: "size", label: "Size" },
  { key: "body_color", label: "Body Color" },
  { key: "border_color", label: "Border Color" },
  { key: "neckline", label: "Neckline" },
]

const METADATA_FIELDS = [SHORT_DESCRIPTION, ...DETAIL_FIELDS]

type Values = Record<string, string>

function readValues(product: AdminProduct): Values {
  const meta = (product.metadata || {}) as Record<string, unknown>
  const values: Values = { description: product.description || "" }
  for (const f of METADATA_FIELDS) {
    const v = meta[f.key]
    values[f.key] = v === undefined || v === null ? "" : String(v)
  }
  return values
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="text-ui-fg-subtle grid grid-cols-2 items-start px-6 py-4">
    <Text size="small" leading="compact" weight="plus">
      {label}
    </Text>
    <Text size="small" leading="compact" className="whitespace-pre-line break-words">
      {value || "-"}
    </Text>
  </div>
)

const ProductDetailsWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Values>(() => readValues(product))

  const current = readValues(product)

  const openEditor = (next: boolean) => {
    if (next) setForm(readValues(product))
    setOpen(next)
  }

  const save = async () => {
    setSaving(true)
    try {
      const metadata: Record<string, unknown> = { ...(product.metadata || {}) }
      for (const f of METADATA_FIELDS) {
        metadata[f.key] = form[f.key].trim()
      }
      await sdk.admin.product.update(product.id, {
        description: form.description.trim() || null,
        metadata,
      })
      await queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success("Product details saved")
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save product details")
    } finally {
      setSaving(false)
    }
  }

  const input = (f: Field) => {
    const props = {
      id: `bhuvan-${f.key}`,
      value: form[f.key],
      onChange: (e: { target: { value: string } }) =>
        setForm((prev) => ({ ...prev, [f.key]: e.target.value })),
    }
    return (
      <div key={f.key} className="flex flex-col gap-y-2">
        <Label htmlFor={props.id} size="small" weight="plus">
          {f.label}
        </Label>
        {f.multiline ? <Textarea rows={f.key === "description" ? 6 : 3} {...props} /> : <Input {...props} />}
      </div>
    )
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Product details</Heading>
        <Button size="small" variant="secondary" onClick={() => openEditor(true)}>
          Edit
        </Button>
      </div>

      <Row label={SHORT_DESCRIPTION.label} value={current.short_description} />
      <Row label="Description" value={current.description} />
      {DETAIL_FIELDS.map((f) => (
        <Row key={f.key} label={f.label} value={current[f.key]} />
      ))}

      <Drawer open={open} onOpenChange={openEditor}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Edit product details</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
            {input(SHORT_DESCRIPTION)}
            {input({ key: "description", label: "Description", multiline: true })}
            {DETAIL_FIELDS.map(input)}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button size="small" variant="secondary" disabled={saving}>
                Cancel
              </Button>
            </Drawer.Close>
            <Button size="small" onClick={save} isLoading={saving}>
              Save
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details",
  id: "bhuvan:product-details",
})

export default ProductDetailsWidget
