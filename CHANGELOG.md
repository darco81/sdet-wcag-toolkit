# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial monorepo scaffold with pnpm workspaces
- TypeScript base configuration
- Prettier and editorconfig setup
- `@sdet-wcag-toolkit/core`: shared types, WCAG 2.2 A/AA catalog (55 criteria),
  severity weights with A-F grading, and per-finding priority scoring
- `@sdet-wcag-toolkit/static-analyzer`: orchestrator plus four analyzers -
  semantic structure, ARIA patterns, keyboard interaction, and color contrast
- File-system source loader and `createDefaultOrchestrator` convenience factory

## [0.1.0] - TBD

Planned: V0.1 Basic - static analysis only.
