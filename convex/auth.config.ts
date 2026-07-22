// Wires Convex to trust Clerk-issued JWTs. This is a Convex-side env var
// (the Convex backend, not Next.js, reads it) — it does NOT go in .env.local.
// Once the Clerk app exists: create a JWT template named "convex" in the
// Clerk dashboard, copy its issuer (e.g. https://your-app.clerk.accounts.dev),
// then run:
//   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
