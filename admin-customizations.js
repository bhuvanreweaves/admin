/**
 * Bhuvan Reweaves changes to the Medusa admin dashboard.
 *
 * Only used while the admin is being built (`medusa build` / `medusa develop`):
 * medusa-config.js requires this file from inside `admin.vite`, so the
 * production server never loads it.
 *
 *  1. Tab title "Bhuvan Reweaves Admin" and light theme by default.
 *  2. Bhuvan Reweaves logo instead of the Medusa logo (login, reset, invite).
 *  3. "Create product" form:
 *     - step 1: extra text fields (saved to the product's metadata in
 *       Supabase); Medusa's "product with variants" section removed.
 *     - step 2: only Categories, Sizes (checkboxes) and one Price. Ticked
 *       sizes become Medusa's "Size" option with one variant per size.
 *       Shipping profile and sales channel are filled in automatically.
 *  4. No "(Optional)" text next to field labels anywhere in the admin. The
 *     fields stay optional; only the label text is hidden.
 *
 * Patches 2, 3 and 4 edit Medusa's dashboard source by exact text match. If a
 * Medusa upgrade changes that source, the patch is skipped with a warning and
 * the build still succeeds; the admin just shows Medusa's original version.
 */
const fs = require("fs");
const path = require("path");

const ADMIN_TITLE = "Bhuvan Reweaves Admin";

/** Product fields shared by the create form and the product page widget. */
const SHORT_DESCRIPTION = ["short_description", "Short description"];
const DETAIL_FIELDS = [
  ["product_code", "Product Code"],
  ["fabric", "Fabric"],
  ["fit", "Fit"],
  ["color", "Color"],
  ["collar", "Collar"],
  ["size", "Size"],
  ["body_color", "Body Color"],
  ["border_color", "Border Color"],
  ["neckline", "Neckline"],
];

/** Sizes offered on step 2 of "Create product", and the price currency. */
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const CURRENCY = "inr";

// 1. Title and theme ---------------------------------------------------------
// The theme default only applies until someone picks a theme in the user menu
// (Medusa stores that choice under "medusa_admin_theme").
const brandingHead = `
    <title>${ADMIN_TITLE}</title>
    <script>
      (function () {
        try {
          if (!localStorage.getItem("medusa_admin_theme")) {
            localStorage.setItem("medusa_admin_theme", "light");
          }
        } catch (e) {}
        try {
          var native = Object.getOwnPropertyDescriptor(Document.prototype, "title");
          Object.defineProperty(document, "title", {
            configurable: true,
            get: function () { return native.get.call(this); },
            set: function () { native.set.call(this, ${JSON.stringify(ADMIN_TITLE)}); },
          });
        } catch (e) {}
      })();
    </script>`;

// 2. Logo --------------------------------------------------------------------
let logoDataUri;
function getLogoDataUri() {
  if (!logoDataUri) {
    const file = path.join(__dirname, "src/admin/assets/bhuvan-reweaves-logo.png");
    logoDataUri = `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  }
  return logoDataUri;
}

const AVATAR_BOX = "function AvatarBox({ checked }) {";

function patchLogo(code) {
  return code.replace(
    AVATAR_BOX,
    `function AvatarBox() {
  return jsx("img", {
    src: ${JSON.stringify(getLogoDataUri())},
    alt: "Bhuvan Reweaves",
    style: { width: 110, height: "auto", marginBottom: 20 }
  });
}
function MedusaAvatarBox({ checked }) {`
  );
}

// 3. Create product form -----------------------------------------------------
const CREATE_FORM_MARKER = "var ProductCreateGeneralSection = (";
// Short description goes right before Medusa's Description field
const DESCRIPTION_FIELD =
  /(\/\* @__PURE__ \*\/ jsx\(\s*Form\.Field,\s*\{\s*control: form\.control,\s*name: "description",)/;
// The other fields go after it, at the end of the General section
const GENERAL_SECTION_END =
  /\)\s*\]\s*\}\);\s*\};(\s*\/\/ src\/routes\/products\/product-create\/components\/product-create-details-form\/components\/product-create-details-media-section)/;
// Add the typed values to the request that creates the product
const NORMALIZE_CALL = /normalizeProductFormValues\(\{(\s*\.\.\.payload,)/;
// Step 1: remove Medusa's "product with variants" section (sizes are on step 2)
const VARIANTS_SECTION =
  /\/\* @__PURE__ \*\/ jsx\d*\(Divider, \{\}\),\s*\/\* @__PURE__ \*\/ jsx\d*\(ProductCreateVariantsSection, \{ form \}\)/;
// Step 2: replace Medusa's Organize section with Categories + Sizes + Price
const ORGANIZE_SECTION = /jsx\d*\(ProductCreateOrganizationSection, \{ form \}\)/;

const createFormHelpers = `
// --- Bhuvan Reweaves: extra product fields (see admin-customizations.js) ---
var BHUVAN_SHORT_DESCRIPTION = ${JSON.stringify(SHORT_DESCRIPTION)};
var BHUVAN_DETAIL_FIELDS = ${JSON.stringify(DETAIL_FIELDS)};
function BhuvanTextField({ form, name, label, multiline }) {
  return jsx(Form.Field, {
    control: form.control,
    name: "bhuvan_meta." + name,
    render: ({ field }) => jsxs(Form.Item, { children: [
      jsx(Form.Label, { children: label }),
      jsx(Form.Control, { children: jsx(multiline ? Textarea : Input, { ...field, value: field.value ?? "" }) })
    ] })
  });
}
function BhuvanShortDescription({ form }) {
  return jsx(BhuvanTextField, { form, name: BHUVAN_SHORT_DESCRIPTION[0], label: BHUVAN_SHORT_DESCRIPTION[1], multiline: true });
}
function BhuvanDetailFields({ form }) {
  return jsx("div", {
    className: "grid grid-cols-1 gap-4 md:grid-cols-2",
    children: BHUVAN_DETAIL_FIELDS.map(([name, label]) => jsx(BhuvanTextField, { form, name, label }, name))
  });
}
// Step 2 hides Shipping profile and Sales channels. Sales channels already
// default to the store's default channel; give the shipping profile the
// store's default too, otherwise the product could not be shipped.
function BhuvanShippingProfileDefault({ form }) {
  useEffect(() => {
    if (form.getValues("shipping_profile_id")) return;
    let cancelled = false;
    sdk.admin.shippingProfile.list({ limit: 100 }).then(({ shipping_profiles }) => {
      if (cancelled || form.getValues("shipping_profile_id")) return;
      const profile = shipping_profiles.find((p) => p.type === "default") || shipping_profiles[0];
      if (profile) form.setValue("shipping_profile_id", profile.id);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [form]);
  return null;
}
var BHUVAN_SIZES = ${JSON.stringify(SIZES)};
var BHUVAN_CURRENCY = ${JSON.stringify(CURRENCY)};
function bhuvanSetPrice(variant, price) {
  const prices = { ...(variant.prices || {}) };
  if (price === "" || price === undefined || price === null) delete prices[BHUVAN_CURRENCY];
  else prices[BHUVAN_CURRENCY] = price;
  return { ...variant, prices };
}
// Turn the ticked sizes into Medusa's "Size" option with one variant per size.
// No sizes ticked = Medusa's normal single default variant.
// priceForAll: set this price on every size; otherwise only on newly added sizes,
// so prices changed per size on the last step are kept.
function bhuvanApplySizes(form, sizes, price, priceForAll) {
  const previous = form.getValues("variants") || [];
  const priced = (variant, isNew) => (priceForAll || isNew ? bhuvanSetPrice(variant, price) : variant);
  if (!sizes.length) {
    const old = previous.find((v) => v.is_default);
    form.setValue("enable_variants", false);
    form.setValue("options", [{ title: "Default option", values: ["Default option value"] }]);
    form.setValue("variants", decorateVariantsWithDefaultValues([priced({
      inventory: [{ inventory_item_id: "", required_quantity: "" }],
      ...(old || {}),
      title: "Default variant",
      should_create: true,
      variant_rank: 0,
      options: { "Default option": "Default option value" },
      is_default: true
    }, !old)]));
    return;
  }
  form.setValue("enable_variants", true);
  form.setValue("options", [{ title: "Size", values: sizes }]);
  form.setValue("variants", decorateVariantsWithDefaultValues(sizes.map((size, index) => {
    const old = previous.find((v) => v.options && v.options.Size === size);
    return priced({
      inventory: [{ inventory_item_id: "", required_quantity: "" }],
      ...(old || {}),
      title: size,
      options: { Size: size },
      should_create: true,
      variant_rank: index,
      is_default: false
    }, !old);
  })));
}
function BhuvanOrganizeSection({ form }) {
  const enabled = useWatch({ control: form.control, name: "enable_variants" });
  const options = useWatch({ control: form.control, name: "options" }) || [];
  const price = useWatch({ control: form.control, name: "bhuvan_price" }) ?? "";
  const sizeOption = enabled ? options.find((o) => o.title === "Size") : null;
  const selected = sizeOption ? sizeOption.values : [];
  const toggleSize = (size, checked) => bhuvanApplySizes(
    form,
    BHUVAN_SIZES.filter((s) => (s === size ? checked : selected.includes(s))),
    price,
    false
  );
  const changePrice = (value) => {
    form.setValue("bhuvan_price", value);
    bhuvanApplySizes(form, selected, value, true);
  };
  const hint = (text) => jsx("span", { className: "txt-small text-ui-fg-subtle", children: text });
  return jsxs("div", { className: "flex flex-col gap-y-8", children: [
    jsx(Heading, { level: "h2", children: "Organize" }),
    jsx(Form.Field, {
      control: form.control,
      name: "categories",
      render: ({ field }) => jsxs(Form.Item, { children: [
        jsx(Form.Label, { children: "Categories" }),
        jsx(Form.Control, { children: jsx(CategoryCombobox, { ...field }) }),
        jsx(Form.ErrorMessage, {})
      ] })
    }),
    jsxs("div", { className: "flex flex-col gap-y-3", children: [
      jsx(Label, { size: "small", weight: "plus", children: "Sizes" }),
      jsx("div", {
        role: "group",
        "aria-label": "Sizes",
        style: { display: "flex", flexWrap: "wrap", gap: 10 },
        children: BHUVAN_SIZES.map((size) => {
          const on = selected.includes(size);
          return jsx(Button, {
            type: "button",
            size: "large",
            variant: on ? "primary" : "secondary",
            "aria-pressed": on,
            style: { minWidth: 64, justifyContent: "center" },
            onClick: () => toggleSize(size, !on),
            children: size
          }, size);
        })
      }),
      hint(
        selected.length
          ? selected.length + (selected.length === 1 ? " size" : " sizes") + " selected: " + selected.join(", ") + ". Click a size again to remove it."
          : "Click the sizes this product comes in. Customers pick one on the website. Leave all unselected for a product without sizes."
      )
    ] }),
    jsxs("div", { className: "flex flex-col gap-y-2", children: [
      jsx(Label, { htmlFor: "bhuvan-price", size: "small", weight: "plus", children: "Price (INR)" }),
      jsx(Input, {
        id: "bhuvan-price",
        type: "number",
        min: 0,
        step: "any",
        placeholder: "3990",
        value: price,
        onChange: (e) => changePrice(e.target.value)
      }),
      hint("Used for every size. You can still change the price of a single size on the last step.")
    ] })
  ] });
}
function bhuvanWithMetadata(form, normalize) {
  return (values) => {
    const product = normalize(values);
    const typed = form.getValues("bhuvan_meta") || {};
    const metadata = {};
    for (const key of Object.keys(typed)) {
      const value = typeof typed[key] === "string" ? typed[key].trim() : "";
      if (value) metadata[key] = value;
    }
    return Object.keys(metadata).length ? { ...product, metadata } : product;
  };
}
`;

function patchCreateForm(code) {
  const anchors = [DESCRIPTION_FIELD, GENERAL_SECTION_END, NORMALIZE_CALL, VARIANTS_SECTION, ORGANIZE_SECTION];
  if (!anchors.every((re) => re.test(code))) {
    return null;
  }
  return (
    code
      .replace(DESCRIPTION_FIELD, `jsx(BhuvanShortDescription, { form }),\n    $1`)
      .replace(
        GENERAL_SECTION_END,
        `),\n    jsx(BhuvanDetailFields, { form }),\n    jsx(BhuvanShippingProfileDefault, { form })\n  ] });\n};$1`
      )
      .replace(NORMALIZE_CALL, `bhuvanWithMetadata(form, normalizeProductFormValues)({$1`)
      .replace(VARIANTS_SECTION, "null")
      .replace(ORGANIZE_SECTION, "jsx(BhuvanOrganizeSection, { form })") +
    createFormHelpers
  );
}

// 4. Hide "(Optional)" -------------------------------------------------------
// Medusa writes "(", t("fields.optional"), ")" inside a muted text element,
// both in its shared Form.Label and in a few one-off forms. Emptying it hides
// the text everywhere without making any field required.
const OPTIONAL_MARKER = 't("fields.optional")';
const OPTIONAL_TEXT = /"\(",\s*t\("fields\.optional"\),\s*"\)"/g;

function patchOptionalLabels(code) {
  return code.replace(OPTIONAL_TEXT, "");
}

// Patch runner -----------------------------------------------------------------
const DASHBOARD_FILE = /@medusajs[\\/]dashboard[\\/]dist[\\/].*\.mjs$/;
const PATCHES = [
  { name: "logo", marker: AVATAR_BOX, apply: patchLogo },
  { name: "create product fields", marker: CREATE_FORM_MARKER, apply: patchCreateForm },
  { name: "hide optional labels", marker: OPTIONAL_MARKER, apply: patchOptionalLabels },
];

function patchDashboardFile(code) {
  let out = code;
  let changed = false;
  for (const p of PATCHES) {
    if (!out.includes(p.marker)) continue;
    const next = p.apply(out);
    if (next && next !== out) {
      out = next;
      changed = true;
    } else {
      console.warn(`[bhuvan-admin] Could not apply "${p.name}" patch; Medusa's dashboard source has changed.`);
    }
  }
  return changed ? out : null;
}

const vitePlugin = {
  name: "bhuvan-admin-customizations",
  transformIndexHtml(html) {
    return html.replace(/<head>/i, `<head>${brandingHead}`);
  },
  // Production build (medusa build)
  transform(code, id) {
    if (!DASHBOARD_FILE.test(id.split("?")[0])) return null;
    return patchDashboardFile(code);
  },
};

// Development server: Vite pre-bundles the dashboard with esbuild, which
// skips the transform above, so apply the same patches there.
const esbuildPlugin = {
  name: "bhuvan-admin-customizations",
  setup(build) {
    build.onLoad({ filter: DASHBOARD_FILE }, async (args) => {
      const code = await fs.promises.readFile(args.path, "utf8");
      const patched = patchDashboardFile(code);
      return patched ? { contents: patched, loader: "js" } : undefined;
    });
  },
};

/** Additions merged into Medusa's own admin Vite config. */
function viteConfig() {
  return {
    plugins: [vitePlugin],
    optimizeDeps: { esbuildOptions: { plugins: [esbuildPlugin] } },
  };
}

module.exports = { viteConfig };
