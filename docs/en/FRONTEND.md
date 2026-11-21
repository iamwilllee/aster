# Frontend conventions

[中文](../FRONTEND.md)

Use React, TanStack Router/Query, Tailwind, shadcn/ui base-nova (Base UI) and Lucide. Reuse existing themes/components rather than introducing parallel systems.

## Components and brand

- src/components/ui holds editable primitives; shared page elements live in common.tsx.
- The Flatpack layer (src/styles/flatpack.css) holds colors/radii/fonts/light/dark and the per-theme entrance pace; styles.css only maps Tailwind color names and keeps Aster's card hover; site.ts holds name/descriptions.
- [Brand](BRAND.md) and [Icon workflow](BRAND-WORKFLOW.md) cover context-driven identity and acceptance; brand.json centralizes paths. Functional icons use Lucide independently of branding.
- Grid/Flex for layout, RevealGroup/CSS for finite entrances. Add resizing/drag/state/animation libraries only for real business needs.

## Component reference

Local /dev/ui and /zh/dev/ui show primitives (three sizes, disabled/errors, dialog Select, checkbox/switch/menu/tooltip/toast), interactive list/detail/dialog/settings/loading/empty/error examples with seven fictional records, and visual typography/replayable motion separately from Sage/Catalog.

Examples are in-memory, reset on refresh and call no providers/create no projects. Staging/production/nonmatching origins return 404. Update references for shared component changes, then inspect desktop/mobile/light/dark/focus/geometry. New Base UI subpaths require client/SSR prebundling in vite.config.ts plus cold-route/hydration checks.

Button/Input/Select/Textarea/Checkbox/Switch/TabsTrigger stay disabled until hydration, preventing first-click/input loss. Preserve this on full language navigation. Test delayed scripts instead of fixed sleeps; CI failure attachments contain isolated traces/screenshots/reports.

## Derive the interface from requirements

Root PROJECT.md distinguishes generated products from the source. Maintain source UI notes privately in .local/PROJECT.md instead of weakening that guard. Product briefs record audience/tasks/references or inferred direction/density/page compositions/brand before implementation. Preserve existing direction; do not routinely append a design questionnaire.

Frequent tools prioritize navigation/scannable operations; reading products prioritize sequence/type/whitespace. Avoid universal title/card grids or forced green/sidebars. Change paired theme tokens centrally, not scattered page colors. Never fabricate capabilities/customers/metrics.

## Product themes

appearance.json selects Sage or Catalog on shared components/geometry/light/dark. Production ignores local preview URL overrides. See [Themes](THEMES.md).

## Typography and reading clarity

The Flatpack theme's --fp-sans centralizes fonts. Sage prefers system-ui; Catalog deliberately prefers Arial then system fallbacks. CJK uses available OS fonts. Defaults make no remote font requests or cross-OS pixel-equality promises.

A named brand font needs licensed actual files/loading source, correct @font-face weight/style/font-display, successful requests and verified fallback/usage. A font-family declaration, computed fontFamily or one document.fonts.check call does not establish which face rendered. Inspect Rendered Fonts or CSS.getPlatformFontsForNode, especially unexpected Latin-to-CJK fallback; normal Chinese text can use system CJK.

| Context           | Starting point                    | Boundary                                                           |
| ----------------- | --------------------------------- | ------------------------------------------------------------------ |
| Marketing/reading | 16–18px body, 1.6–1.8 line height | Do not shrink primary reading to metadata sizes                    |
| Compact tools     | 14–16px body                      | Preserve 32/40/48 controls and their type contract                 |
| Metadata          | 12–14px with readable contrast    | Tiny decorative labels cannot carry critical actions               |
| Sans headings     | 600/700 by hierarchy              | Modest Latin tightening (example -0.03em), normal Chinese tracking |

Preserve deliberate brands/serif directions. No global bolding/scaling/text-shadow/stroke/blur/GPU layer tricks to disguise rendering. antialiased is a preference, not a universal fix.

At 100% browser zoom after fonts/styles settle, inspect both locales, desktop/mobile, both product themes/light/dark, real faces, long-title wrapping, controls/tables and reading. Wait for finite motion/transitions before native-pixel screenshots; compressed/resized images alone cannot prove jaggies. Existing products adopt incrementally under [Upgrading](UPGRADING.md), not by overriding brand fonts or updating only a Skill.

## Page motion

Marketing uses finite light motion: heading → description → action → display, then one-time below-fold reveals. Dense tools/forms do not wait. Sage uses 560ms/70ms steps; Catalog 480ms/50ms, with smaller/faster mobile motion. The pace comes from the Flatpack theme's --fp-reveal-* variables: adjust those, not scattered timings.

Reuse ui/reveal.tsx RevealGroup without changing Grid/Flex or heading/list/link semantics. It renders div, not ol/li or a reason to override controls.

```tsx
<RevealGroup className="grid gap-6">
  <h1 data-reveal="enter">Product title</h1>
  <p data-reveal="enter" data-reveal-step="1">
    What it does.
  </p>
  <article data-reveal="scroll">More information.</article>
</RevealGroup>
```

enter is CSS-driven with data-reveal-step 0–4. Observer progressively enhances scroll, hiding only elements initially below the viewport and revealing once. Already visible/above-viewport content does not flash hidden. New dynamic nodes stay readable; mount an independent group if needed. No per-letter headings, animated line-height/width/height, blurred/scaled body text or permanent transform/will-change. motion-hover adds subtle desktop shadow, not a false working-service affordance.

Reduced-motion shows content immediately and preference changes clear pending reveals. Missing/failed Observer or no scripts remain readable. Keyboard focus reveals hidden content immediately. Availability/permissions/loading/errors must not depend on animation completion. No dependency is required for basic motion; add libraries only for real complexity.

/dev/ui has replay examples; product/shop blueprints show entrances/reveals. Validate actual starts/order/ends, natural settled text, one-time scroll, keyboard/reduced-motion/no-script, themes/locales/mobile. Static screenshots or disabled-animation tests cannot establish temporal behavior.

## Full page blueprints

[Page blueprints](PAGE-BLUEPRINTS.md) explains marketing, reading, catalog and workspace compositions at local /dev/blueprints. Brands/items are fictional/in-memory, remote entries closed. Reuse content-patterns features/process/FAQ and ui/disclosure keyboard/SSR semantics, then connect real data/routes without inheriting demo behavior or pass claims.

## Pattern and component index

| Need              | Entry                                  | Boundary                                                         |
| ----------------- | -------------------------------------- | ---------------------------------------------------------------- |
| Entrances/reveals | ui/reveal.tsx RevealGroup              | Finite marketing sequence with accessibility/fallbacks           |
| Toolbar           | patterns/page-patterns.tsx ListToolbar | search/filters/actions; URLs remain business-owned               |
| Loading/empty     | ListSkeleton, EmptyState               | Distinguish first-empty/no-results/errors; ErrorNotice retry     |
| Settings          | SettingsSection                        | Responsive grouping and unique IDs                               |
| Details           | DetailList + Dialog                    | Long text, scrolling, focus                                      |
| Pagination        | Pagination                             | Controlled one-based page/count; reset on filters                |
| Tables            | ui/table.tsx                           | caption/th semantics, internal narrow-screen scroll              |
| Tabs              | ui/tabs.tsx                            | Content grouping; use links for navigation                       |
| Menus             | ui/dropdown-menu.tsx                   | Trigger render Button, separated/confirmed danger                |
| Checkbox/switch   | ui/checkbox.tsx, ui/switch.tsx         | Label/control/name/checked semantics                             |
| Tooltip           | ui/tooltip.tsx                         | Button/aria-label; critical info cannot be tooltip-only          |
| Feedback          | ui/use-toast.ts useToast               | Success only after server confirmation; persistent errors remain |

Real project/settings examples use actual owner data, not sample records. Sample project APIs return at most 100 rows and plans allow at most 50, so full-return client pagination uses six/page. Scaling requires server pagination/filter/total; page length is not a global total.

```tsx
const toast = useToast()
// Only after confirmed server success.
toast.add({ title: t('project_saved'), type: 'success' })

<DropdownMenu>
  <DropdownMenuTrigger render={<Button variant="outline" />}>Actions</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={openDetails}>View details</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Toast/Tooltip managers are per React tree, not global mutable SSR state. Toast: five seconds, max three visible, dismissible; never replace actionable persistent errors. Tabs/Checkbox/Switch geometry stays in components. Tabs default manual activation: arrows focus, Enter/Space switches; set TabsList activateOnFocus explicitly for automatic mode. Tooltip focus via keyboard is not the same as programmatic focus. Keep pre-hydration form/action disabling. FaqList uses native SSR/keyboard ui/disclosure details/summary without another collapse library.

## Control geometry contract

Business code imports Button/Input/Select/Textarea from @/components/ui. Select uses Base UI popovers/focus/theme; native business select is not a substitute. Primitive components normally render native DOM internally.

Component source also comes from Flatpack: `src/components/flatpack/` is copied unmodified by `pnpm flatpack:sync`, is never hand-edited in a product, and `pnpm flatpack:sync --check` detects drift. `src/components/ui/` holds Aster's wrappers: they re-export those components and add only Aster behavior (inert-until-hydrated, localized close label, the compound Select form, on-demand Tabs panels). New general capability goes into Flatpack first, then syncs; only Aster-specific behavior is written in `ui/`. Alert (error notices), Empty (empty states), Sidebar (workspace navigation), Tooltip and Toast come from Flatpack too: Toast is request-local through `ToastProvider` and `useToast()`, and no global manager is created at module load.

| Size    | Height | Use                     |
| ------- | ------ | ----------------------- |
| sm      | 32px   | Compact toolbar         |
| default | 40px   | Forms/filters           |
| lg      | 48px   | Prominent/touch actions |

Button/Input/SelectTrigger share size; icon buttons use icon-sm/icon/icon-lg. Source: Flatpack --fp-control-sm/md/lg and ui/control.ts. Align same-row controls. Use grid gap-2 field wrappers to avoid hidden Base UI form inputs affecting space-y margins. Input/Textarea are block-level; control type is 14px desktop/16px mobile. Textarea is multiline (three rows/min96px), not single-line height.

```tsx
<Input size="default" aria-label="Search" className="w-full" />
<Button size="default">Search</Button>
```

Select Root items maps labels for SSR/controlled values/localization, Root name participates in FormData, Label targets Trigger. Fixed choices use Select; searchable long lists need an appropriate extra control.

```tsx
<Label htmlFor="status">Status</Label>
<Select name="status" defaultValue="idea" items={{ idea: 'Idea', live: 'Live' }}>
  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="idea">Idea</SelectItem>
    <SelectItem value="live">Live</SelectItem>
  </SelectContent>
</Select>
```

Pages own width/position/external spacing, not control height/vertical padding/type/radius. Adjust shared tokens/variants for new density. Button-like Link spreads buttonProps with true link semantics; ordinary nav/text links remain ordinary. Input's native character-width prop is htmlSize.

ESLint rejects native business button/input/select/textarea, direct Base UI and geometry overrides, including aliases/responsive/cn/clsx/limited conditionals. Unanalyzable dynamic control classes/styles belong in UI components. Narrow explained inline exceptions are allowed, never file-wide disabling. Static rules do not replace rendered layout/focus/keyboard or control arbitrary global CSS.

## State ownership

Validated URLs own shareable search/filter/page state; loaders/Query own server caches; React owns form/dialog/local interaction; server auth/DB own sessions/permissions/entitlements. Avoid duplicate authorities, isolate SSR locale/caches per request and clear private client state at logout. Save status follows server confirmation.

## Public page copy

Before delivery remove unchosen early-preview banners, test accounts/data/placeholders, sample plans and framework promotion from real product pages. Use current-product titles/buttons/status/footer; cloud publication is not local publication. Preserve intentional evidenced Beta, excerpts/private editor previews; do not mechanically remove every preview.

Hide unavailable entries or describe actual unavailable payment/booking beside the relevant action. Removing diagnostics cannot imply a connected feature. Keep isolated demos/test billing honestly labeled, never relabel fiction as business. Inspect the actual product; a Skill update does not clean existing sites.

## Page acceptance

Cover loading/empty/error/retry/disabled/success, keyboard/focus/names/mobile/themes. Save → refresh verifies persistence; build/screenshots alone do not prove behavior. English defaults, Chinese /zh, paired dictionaries and locale:check; public provider errors stay sanitized. Run check/format:check and workflow E2E/rendered checks as relevant.

## Actual content flows

content uses grouped drafts, separate preview, revisions and publish/withdraw confirmations in /app/content; /content lists/reads articles. Reuse themes/shared controls, no rich-text framework. See [Content](CONTENT.md) for draft/live and personal/site-asset boundaries.
