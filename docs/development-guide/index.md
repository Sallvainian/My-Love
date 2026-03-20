# Development Guide

Comprehensive developer reference for the My-Love PWA. Each section links to a dedicated page with full details.

Last updated: 2026-03-20

## Table of Contents

- [Prerequisites](./prerequisites.md) -- Required tools and versions
- [Installation](./installation.md) -- Clone, install, and verify
- [Environment Setup](./environment-setup.md) -- fnox secrets management with age encryption
  - [How Secrets Are Managed](./environment-setup.md#how-secrets-are-managed)
  - [Environment Files](./environment-setup.md#environment-files)
  - [Getting Started with Environment Variables](./environment-setup.md#getting-started-with-environment-variables)
  - [Required Variables](./environment-setup.md#required-variables)
  - [Modifying Secrets](./environment-setup.md#modifying-secrets)
  - [E2E Test Environment](./environment-setup.md#e2e-test-environment)
  - [CI Environment](./environment-setup.md#ci-environment)
- [Configuration & Customization](./configuration-customization.md) -- Vite, TypeScript, PostCSS, Tailwind, ESLint configs
  - [Vite Configuration](./configuration-customization.md#vite-configuration)
  - [TypeScript Configuration](./configuration-customization.md#typescript-configuration)
  - [PostCSS Configuration](./configuration-customization.md#postcss-configuration)
  - [Tailwind CSS v4](./configuration-customization.md#tailwind-css-v4)
  - [ESLint Configuration](./configuration-customization.md#eslint-configuration)
- [Available Scripts](./available-scripts.md) -- Every npm script (30 total) with usage examples
  - [Development](./available-scripts.md#development)
  - [Build & Performance](./available-scripts.md#build--performance)
  - [Code Quality](./available-scripts.md#code-quality)
  - [Testing](./available-scripts.md#testing)
  - [Deployment](./available-scripts.md#deployment)
- [Local Development URL](./local-development-url.md) -- Dev vs. production base paths
- [Development Workflow](./development-workflow.md) -- Branch strategy, commit format, PR process
  - [Branch Strategy](./development-workflow.md#branch-strategy)
  - [Step-by-Step Workflow](./development-workflow.md#step-by-step-workflow)
  - [Commit Message Format](./development-workflow.md#commit-message-format)
  - [Commit Rules](./development-workflow.md#commit-rules)
  - [PR Review Process](./development-workflow.md#pr-review-process)
- [Build Process](./build-process.md) -- Production build pipeline, code splitting, PWA generation
  - [Build Stages](./build-process.md#build-stages)
  - [Manual Chunks (Code Splitting)](./build-process.md#manual-chunks-code-splitting)
  - [PWA Manifest Generation](./build-process.md#pwa-manifest-generation)
  - [Service Worker](./build-process.md#service-worker)
  - [Sentry Source Maps](./build-process.md#sentry-source-maps)
  - [Bundle Analysis](./build-process.md#bundle-analysis)
- [Project Structure](./project-structure.md) -- Annotated directory layout
  - [Source Code (src/)](./project-structure.md#source-code-src)
  - [Tests (tests/)](./project-structure.md#tests-tests)
  - [Supabase (supabase/)](./project-structure.md#supabase-supabase)
  - [Scripts (scripts/)](./project-structure.md#scripts-scripts)
  - [CI/CD (.github/)](./project-structure.md#cicd-github)
- [Testing](./testing.md) -- Unit, E2E, database, smoke, and burn-in tests
  - [Unit Tests (Vitest)](./testing.md#unit-tests-vitest)
  - [E2E Tests (Playwright)](./testing.md#e2e-tests-playwright)
  - [Test Infrastructure](./testing.md#test-infrastructure)
  - [Database Tests (pgTAP)](./testing.md#database-tests-pgtap)
  - [Smoke Tests](./testing.md#smoke-tests)
  - [Burn-In (Flaky Detection)](./testing.md#burn-in-flaky-detection)
  - [CI Test Pipeline](./testing.md#ci-test-pipeline)
  - [Priority Tags](./testing.md#priority-tags)
- [Code Style](./code-style.md) -- TypeScript, ESLint, Prettier, logger utility, no-console rule
  - [TypeScript](./code-style.md#typescript)
  - [ESLint](./code-style.md#eslint)
  - [Logger Utility](./code-style.md#logger-utility)
  - [Prettier](./code-style.md#prettier)
  - [Naming and Import Conventions](./code-style.md#naming-and-import-conventions)
- [Database Migrations](./database-migrations.md) -- All 25 migrations, Supabase CLI, pgTAP tests
  - [Local Supabase Setup](./database-migrations.md#local-supabase-setup)
  - [Creating Migrations](./database-migrations.md#creating-migrations)
  - [Migration History](./database-migrations.md#migration-history)
  - [Generating TypeScript Types](./database-migrations.md#generating-typescript-types)
  - [CI Migration Validation](./database-migrations.md#ci-migration-validation)
  - [Database Tests (pgTAP)](./database-migrations.md#database-tests-pgtap)
- [Deployment](./deployment.md) -- All 19 CI/CD workflows, GitHub Pages, health checks
  - [Automatic Deployment](./deployment.md#automatic-deployment)
  - [CI/CD Workflows](./deployment.md#cicd-workflows)
  - [Required GitHub Secrets](./deployment.md#required-github-secrets)
  - [Post-Deploy Verification](./deployment.md#post-deploy-verification)
- [Troubleshooting](./troubleshooting.md) -- Common issues and solutions

## Quick Reference

| Item            | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| Live URL        | <https://sallvainian.github.io/My-Love/>                       |
| Stack           | React 19.2.4, TypeScript 5.9.3, Vite 7.3.1, Tailwind CSS 4.2.1 |
| Backend         | Supabase 2.99.0 (Auth, Database, Realtime, Storage)            |
| Testing         | Vitest 4.0.18, Playwright 1.58.2, pgTAP                        |
| Node            | v24.13.0 (managed by mise, pinned in `.node-version`)          |
| Package manager | npm                                                            |
| Secrets         | fnox with age provider (`fnox.toml`)                           |
| Source files    | ~177                                                           |
| Test files      | ~108 (94 TS/TSX + 14 pgTAP)                                    |
| Migrations      | 25                                                             |
| CI workflows    | 19                                                             |
