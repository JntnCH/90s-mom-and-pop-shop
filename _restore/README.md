# Settings restore

Full `settings.tsx` was split into base64 parts under `_restore/` because of tool size limits.

Assemble with:

```bash
cat _restore/settings.part*.b64 | base64 -d > src/routes/settings.tsx
```

Then commit the restored file.
