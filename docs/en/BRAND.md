# Aster brand

[中文](../BRAND.md)

**A reliable starting point for your agent.**

Aster is an open-source product foundation for AI agents, built on TanStack Start and Cloudflare.

![Aster](../../public/brand/aster-logo.svg)

## Logo

Six petals radiate around a negative-space center, combining a flower and a starburst to suggest products growing from one starting point. Use forest green with a light symbol. Small icons keep all six petals without a wordmark.

- [Light wordmark](../../public/brand/aster-logo.svg)
- [Dark wordmark](../../public/brand/aster-logo-dark.svg)
- [Application icon](../../public/brand/aster-icon.svg) · [Transparent monochrome symbol](../../public/brand/aster-symbol.svg)
- [Favicon](../../public/favicon.svg)

Editable vector assets are included under the repository's MIT license. Primary colors are `#236b4b` and `#eff6e9`. Preserve aspect ratio and clear space of at least a quarter of the symbol width. UI branding uses the application icon and project font.

## Naming and compatibility

The product is **Aster**, repository `iamwilllee/aster`, Skill `$aster-new`, initializer `pnpm aster:new`.

`starter:new` remains compatible. Keep internal identifiers `starter-version.json`, `starter.project.json`, `starter-db`, protocol headers and theme storage keys to preserve data/recovery behavior; these are not the public brand. Existing READMEs are preserved, with initializer notes in ASTER.md.

New products change name/description in `src/config/site.ts` and navigation, optional dark, favicon and optional home-screen asset paths in `src/config/brand.json`. Assets live in `public/`. Default Aster assets are placeholders for the new product; follow [Product icon workflow](BRAND-WORKFLOW.md) for context-driven design, integration and rendered acceptance. Preserve starter provenance and licensing.
