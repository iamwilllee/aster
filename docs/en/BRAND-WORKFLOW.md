# Product icon design and integration

[中文](../BRAND-WORKFLOW.md)

Run this during a new product's first implementation. Existing products keep their identity; adopt changes only when branding/icons are in scope. When naming/page direction can be inferred, implement a first version rather than requiring a questionnaire or fixed style selection. Existing logos, explicit preferences and references take priority. Do not redesign a brand as a side effect of a business bug fix.

## Design from context

Read PROJECT.md, product name, user tasks, audience, pages and existing assets. Record one sentence explaining the symbol, its product fit and palette relationship. Without an existing brand, the Agent chooses and implements a direction in a runnable page for review. Offer alternatives when the user requests comparison.

Optional directions are a design vocabulary, not mandatory templates or configuration enums:

| Direction                 | Context clues                                           | Focus                                                                               |
| ------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Geometry / negative space | Precision, structure, lightweight tools                 | Simple distinctive silhouettes; avoid excessive thin lines                          |
| Letter / wordmark         | A recognizable name or established typographic identity | Keep the core glyph at small sizes; avoid automatic initial-in-rounded-box formulas |
| Object / symbol           | A clear metaphor for the task                           | Distill one idea instead of copying a generic functional icon                       |
| Organic / illustration    | Everyday life, creativity, approachability              | Preserve silhouette and prepare a simplified small version                          |

Combine these or create another direction. Sage/Catalog are page themes, not icon-style restrictions; icons need not all be green. Functional controls continue using Lucide while product branding is designed independently.

## Production and assets

- Prefer maintainable SVG for simple marks. For illustration/textures, use available image-generation tools/Skills when appropriate. If unavailable, continue with a deliverable vector direction or identify the missing capability; never claim generation was performed when it was not.
- Avoid externally hotlinked assets. Preserve editable sources, provenance and licenses. Recoloring another product's logo is not original design; do not claim trademark clearance.
- Deliver a navigation icon, favicon and necessary transparent/light/dark versions. An Apple home-screen icon must be an actually exported 180×180 PNG, configured only after checking the file. Add PWA 192/512 icons and a manifest only when installability is required; having an image does not make a PWA.
- Favicon must remain recognizable at 16/32px: fewer details, enough padding, no full product name. Apple icons keep an opaque background and do not pre-cut system corners. Provide wordmarks when useful rather than generating unused variants.

## Integration

`src/config/brand.json` centralizes `icon` (navigation), optional `iconDark`, `favicon` and optional `appleTouchIcon`. Paths begin at the public root. Keep unproduced optional assets null. Name/description remain in `src/config/site.ts`, theme variables in styles.css; do not duplicate brand names.

Default Aster assets are initializer placeholders, not completed product branding. The generator leaves a `brand-identity` task and required local acceptance. Continue design, update references and remove unused template brand assets while preserving starter source/license records. Do not mechanically replace internal starter identifiers. A Skill update does not update existing sites.

Record rationale, chosen/inferred direction, asset paths, provenance/license and actual acceptance in PROJECT.md. Record `brand-direction` in starter.project.json decisions with truthful user/context/default basis and current-product evidence. Existing identities may be recorded as retained after real review; do not force a redraw or inherit upstream pass claims.

## Acceptance and handoff

Run `pnpm brand:check` for local paths, nonempty files and extension/MIME agreement. It does not prove visual quality, originality, actual PNG dimensions or removal of template residue. Run the product's build/types and relevant browser checks.

Open the homepage, login and workspace entries that display the brand. Check desktop/mobile, both languages and light/dark. Icons must not distort, crowd text or change control geometry. Verify loading/transparency and actual 16/32px favicon display, tab/home-screen references and actual PNG dimensions if configured. Distinguish file/browser validation from unperformed real-device home-screen testing.

Audit Aster template assets/references while preserving legitimate open-source attribution. Record screenshots/actions in the product's brand-identity acceptance; file checks alone do not pass visual acceptance. Reset affected evidence after a change. If tools/materials block completion, leave precise pending items rather than calling default icons finished. Publication follows the user's actual authorization.
