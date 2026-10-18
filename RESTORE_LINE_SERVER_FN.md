# Restore line-server-fn.ts (required)

During D1 migration, `src/lib/line-server-fn.ts` was accidentally overwritten.

## Quick restore + D1 patch

```bash
git checkout b5086414b3154dec6cd28e790fe95f070d5b4425 -- src/lib/line-server-fn.ts
git apply drizzle/d1-line-server-fn.patch
git add src/lib/line-server-fn.ts
git commit -m "fix: restore line-server-fn with Cloudflare D1 primary sync"
git push
```

Or download the fixed file from the project artifacts folder: `line-server-fn.ts`
