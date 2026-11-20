# Sage and Catalog visual themes

[中文](../THEMES.md)

Aster wraps Base UI and styles it with the Flatpack data-slot layer (src/styles/flatpack.css) across two product themes. Sage and Catalog are Flatpack themes switched by data-fp-theme; they are defined in the Flatpack repository and copied into products with `pnpm flatpack:sync`. Both support English/Chinese, light/dark and mobile without another framework or cloud service.

| Theme          | Direction                                                                                                        | Typical use                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| sage (default) | System UI fonts, green accents, soft neutral backgrounds, moderate corners and clear action/data hierarchy       | Tools, SaaS, member workspaces                   |
| catalog        | Neutral black/white, Arial typography, generous whitespace, image-first layouts, subtle borders and pill actions | Catalogs, selling showcases, portfolios, content |

Catalog is not an official IKEA theme and contains no IKEA logo, product images or code. These are suggestions, not product-type restrictions. Themes do not implement inventory, carts, orders, logistics or payments. Real selling requires separate business implementation/acceptance. Shop blueprint artwork/products/prices are fictional.

Neither default theme requires external font services. Sage uses system UI; Catalog deliberately prefers Arial with system fallbacks. Brand fonts must actually load, not just be named. See [Typography and reading clarity](FRONTEND.md#typography-and-reading-clarity) for size/weight/CJK tracking/rendered-font checks.

## Let the Agent choose

```text
$aster-new Build a small product showcase with the Catalog theme. Show products and details first; do not add orders, payments or login yet.
```

Read existing brand/code first, record direction/actions/composition in PROJECT.md and visual-theme in starter.project.json decisions with sage|catalog and user/context/default basis. Initialization consumes a resolved decision into src/config/appearance.json. Without a choice it uses Sage, not source preview state.

```json
{
  "decisions": [
    {
      "id": "visual-theme",
      "question": "Product visual theme",
      "status": "resolved",
      "value": "catalog",
      "basis": "user",
      "reason": "The user requested a neutral product catalog direction",
      "blocking": false
    }
  ]
}
```

Merge this into the plan and initialize with `pnpm aster:new ../my-site --plan /tmp/product-plan.json`. Preserve other decisions. Existing products update appearance.json and records incrementally and rerun affected acceptance. No DB migration is needed; do not overwrite business styles/assets.

## Local comparison and production selection

The `/dev/blueprints` header previews themes/page types. Examples:

- `/dev/blueprints?kind=workbench&_style=sage`
- `/dev/blueprints?kind=shop&_style=catalog`

URL previews do not change files and persist through local navigation. _style applies only to the matching local origin. Staging/production ignore it and use appearance.json; development blueprints return 404 remotely. SSR sets html data-visual-theme, avoiding a wrong-theme flash. User light/dark preference uses the existing toggle/localStorage independently of product theme.

Colors, fonts and corners live in the Flatpack layer; shared controls use --fp-radius-control and --fp-radius-surface, and src/styles.css only maps Tailwind color names. Single-line controls are 32/40/48px with no per-page overrides. Multiline fields keep text-appropriate corners. Layout comes from page composition; a color swap alone is not product design. Check desktop/mobile, locales, light/dark, keyboard and real interactions under [Frontend](FRONTEND.md) and [Page blueprints](PAGE-BLUEPRINTS.md).
