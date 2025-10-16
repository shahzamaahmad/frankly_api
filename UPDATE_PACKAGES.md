# Package Update Instructions

## Critical Package Vulnerabilities Found

Run the following commands to update vulnerable packages:

```bash
cd api
npm audit fix --force
npm update
```

## Specific Vulnerabilities

1. **Package vulnerabilities** in package-lock.json
   - Run `npm audit` to see details
   - Run `npm audit fix` to automatically fix
   - For breaking changes, run `npm audit fix --force`

## After Update

1. Test all API endpoints
2. Verify authentication still works
3. Check file uploads
4. Test database connections
