# Aster documentation

[English website](https://aster.iamwilllee.com/docs) · [中文文档](../README.md)

The Skill and its execution reference are maintained in English. Conversation and human project handoff follow the user's language. Chinese technical guides keep their legacy paths under docs/; English equivalents live in docs/en/. Both site locales use the same topic catalog and link to the matching language.

These are current-source guides. The published v0.2.0-beta.1 remains the reproducible starting point; newer guidance may precede a new source release. Check the [release scope](releases/0.2.0-beta.1.md) before adoption.

- Start: [Agent guide](AGENT-GUIDE.md), [Capabilities](MODULES.md), [Development](DEVELOPMENT.md), [Brief](templates/PROJECT-BRIEF.md).
- Design: [Frontend](FRONTEND.md), [Page blueprints](PAGE-BLUEPRINTS.md), [Themes](THEMES.md), [Brand](BRAND.md), [Icon workflow](BRAND-WORKFLOW.md).
- Accounts/content: [Security](ACCOUNT-SECURITY.md), [Lifecycle](ACCOUNT-LIFECYCLE.md), [Admin](ADMIN.md), [Files](FILES.md), [Editorial content](CONTENT.md).
- Cloud: [Architecture](CLOUDFLARE.md), [Costs](COSTS.md), [Mail](MAIL.md), [Provider checkpoints](SERVICE-WORKFLOW.md), [Database](DATABASE.md), [Deployment](DEPLOYMENT.md), [Payments](PAYMENTS.md).
- Maintenance: [Upgrading](UPGRADING.md), [Releasing](RELEASING.md).

## Maintain both languages

Keep corresponding filenames and technical identifiers/commands/safety boundaries aligned. Update both documents when behavior changes; add new public topics to docs/catalog.json. The docs:check command verifies coverage, source fingerprints, links and headings, not translation quality or actual provider behavior. Review translations semantically, especially authorization, irreversible changes, payment TEST-only and evidence distinctions.

- Development efficiency: [Task usage](AGENT-USAGE.md).
