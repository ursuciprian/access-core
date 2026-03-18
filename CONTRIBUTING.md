# Contributing

Thanks for your interest in contributing to AccessCore.

## Development Flow

1. Fork the repository
2. Create a branch for your change
3. Make focused commits
4. Run tests and build verification locally
5. Open a pull request with a clear summary

## Local Checks

Use these commands before opening a PR:

```bash
npm test
npx next build --webpack
```

`npm run build` may still fail in some local environments because of the known Next.js Turbopack CSS panic, so webpack build verification is the reliable fallback in this repo today.

## Pull Request Guidance

- keep changes focused
- include screenshots for UI changes when possible
- call out schema, env, or deployment changes explicitly
- include migration notes if a change affects existing installs

## Security-Sensitive Areas

Please be especially careful around:

- authentication
- authorization
- certificate operations
- remote command execution
- server management
- secrets handling

If you are unsure whether a change could weaken security, open an issue or draft PR first.
