# Page planning and optional compositions

[中文](../PAGE-BLUEPRINTS.md)

Blueprints help an Agent turn requirements into meaningful flows, not another capability switch. Read current PROJECT.md/pages/brand/components and preserve existing design. With no reference, infer from actual users/tasks instead of routinely asking for a template choice.

## From requirements to pages

Before implementation, record in PROJECT.md with user/context/inference provenance and unknown facts left unresolved:

1. Audience/context, desired result and success criteria.
2. Entry → browse/input → detail/result → next action, with each page's main task rather than a generic page list.
3. Questions, reading order, density and transitions. A marketing page need not contain every possible section; a simple tool need not sit behind a long landing page.
4. Actual records/user material/verified sources/labeled fiction/missing content. Omit unsupported reviews/customer counts/metrics rather than inventing endorsements, payment or connectivity claims.
5. Brand-based/inferred type/color/whitespace/layout while preserving shared control geometry and keyboard semantics.
6. Loading/empty/error/retry/success/long-content/permission/unconfigured states. Distinguish persistence from demos; only confirmed server success is a saved result.

Use page-composition decisions, source-path tasks and current-product acceptance in starter.project.json; no new runtime feature is needed. Copying examples does not inherit their acceptance. Reset affected evidence after changes.

## Four optional blueprints

| Type              | Flow                       | Reusable structure                                                              | Sample                                                             |
| ----------------- | -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Product site      | Understand → try/start     | Hero, product illustration, feature rows, process, brief form, FAQ, next action | Fictional Fieldnote: explain → three-field brief → review result   |
| Directory/reading | Discover → read/contribute | Search/categories, editorial list/detail, TOC/related links, submission         | Fictional Margin: search/read/temporary contribution               |
| Product catalog   | Browse imagery → detail    | Image-first hero/search/grid/detail/purchase-information preview                | Fictional Ordinary Objects, no real orders                         |
| Data workspace    | Frequent direct operations | Compact toolbar, real-sample-derived progress, master/detail, forms/states      | Fictional Launchpad: filter/edit/two-step form/loading/empty/error |

Combine compositions as useful. They do not select auth/billing/AI/files. A public directory need not require login; ordinary tools need not use AI; content demos are not a connected CMS.

Samples avoid preinstalled tracking/CMS/chart/motion libraries and external imagery. Define a chart's question/data/units first, then add real images/video/metrics as needed. Do not add multiple control systems or wrap everything in cards for apparent richness.

## Preview and source

Use local /dev/blueprints or /zh/dev/blueprints, also linked from /dev/ui. kind=product|directory|workbench selects examples and preserves refresh/language navigation. Sample business state stays in memory and resets on refresh/exit.

| Source                                       | Purpose                                            |
| -------------------------------------------- | -------------------------------------------------- |
| src/routes/dev/blueprints.tsx                | Local entry/selection/demo boundary                |
| src/components/dev/blueprints/product.tsx    | Marketing + brief/result                           |
| src/components/dev/blueprints/directory.tsx  | Search/categories/reading/temporary contributions  |
| src/components/dev/blueprints/workbench.tsx  | Table/detail/edit/two-step forms/state preview     |
| src/components/patterns/content-patterns.tsx | ContentHeading, FeatureRows, ProcessSteps, FaqList |
| src/components/ui/progress.tsx               | Accessible range/current progress                  |
| src/components/ui/disclosure.tsx             | SSR/keyboard-native details/summary                |

Marketing/catalog reuse RevealGroup for finite entrances and first viewport reveals in FeatureRows/ProcessSteps. Dense workspaces stay immediate. See [Motion](FRONTEND.md#page-motion).

No sample calls DB/mail/payment/models or saves accounts. Brands/items are fictional; workspace progress reflects sample records, not operations metrics. Explicit controls simulate loading/errors honestly. Entries require ENVIRONMENT=local and matching loopback origin; staging/production return 404 in both languages. Exclude them from public navigation/sitemap.

## Adopt into a real product

Move useful structure/controls, then connect real routes/models/private APIs. Copying sample state is not a launch.

- Replace fictional names/fields/reading copy with real domain content; never inherit demo brands in name/SEO.
- Scale with server search/pagination/totals; client filtering only suits complete bounded datasets.
- Submission needs ownership/validation/persistence/review/publication scope/error feedback. Local additions are not publication.
- Explain whether a result is formatting/calculation/external generation; no model call means no completed AI claim.
- Controlled repository content can precede a CMS; maintain actual source/update/license/visibility.
- Select/accept external capabilities separately under [Modules](MODULES.md), without unused service buttons/bindings/costs for layout.

Test entry/action/result/refresh persistence, relevant cross-user access, failures and disconnected services. Inspect locales/themes/mobile/long text/focus/disclosure/dialogs. Sample reset-on-refresh is not acceptable for real saved data.

See [Frontend](FRONTEND.md), [Modules](MODULES.md), [Agent guide](AGENT-GUIDE.md).

## Catalog and themes

kind=shop includes original illustration, fictional products/prices, search/detail/purchase-information preview/FAQ; refresh resets and no order/payment is created. Compare neutral Catalog with green Sage in the local header under [Themes](THEMES.md). References inform principles, not copied personal assets or real product data.
