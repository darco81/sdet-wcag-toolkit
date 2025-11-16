# Contributing

Thanks for the interest. This repo is a personal project first, so the bar for
accepting external contributions is "small, focused, well-tested".

## Local setup

```bash
pnpm install
pnpm -r build
pnpm -r test
```

Node 20+ and pnpm 10+ required (see `.nvmrc` and `packageManager` in
`package.json`).

## Commit style

Conventional Commits: `<type>(<scope>): <subject>`.

Types used: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`.
Scopes match package names: `core`, `static-analyzer`, `cli`, etc.

Atomic commits only - one concern per commit.

## Pull requests

- Branch from `main`
- Run `pnpm format` and `pnpm test` before opening
- Include a short rationale in the PR body
- Link to the WCAG Success Criterion if the change affects a rule
