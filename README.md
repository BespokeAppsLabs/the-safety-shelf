# The Safety Shelf

Digital bookstore for practical health and safety guides, with a reader-facing storefront and an agentic owner-admin that can draft, translate, narrate, illustrate, and publish books through propose-then-confirm workflows.

## Run locally

```bash
npm install
npm run dev
```

The app runs at <http://localhost:5050>.

## Verify

```bash
npm test
npm run build
```

## Documentation

Start with [`docs/00-overview.md`](docs/00-overview.md). The repository-level `../docs/` directory contains project planning documents and the owner-facing feature sheet.

## Deployment compatibility

The npm package and GitHub repository are `the-safety-shelf`. The existing Vercel project/domain and the legacy `midnight-library-ai-credentials` encryption salt intentionally retain their old identifiers to avoid breaking deployment links or encrypted BYOK credentials.
