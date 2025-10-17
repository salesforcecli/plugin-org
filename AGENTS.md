# Agent Guidelines for this oclif plugin

This file provides guidance when working with code in this repository.

## Project Overview

This is `@salesforce/plugin-org`, an oclif plugin for the Salesforce CLI that provides commands for working with Salesforce orgs (scratch orgs, sandboxes, production orgs). It is bundled with the official Salesforce CLI and follows Salesforce's standard plugin architecture.

## Common Commands

### Development

```bash
# Install dependencies and compile
yarn install
yarn build

# Compile TypeScript (incremental)
yarn compile

# Run linter
yarn lint

# Format code
yarn format

# Run local development version of CLI
./bin/dev.js org list
./bin/dev.js org create scratch --help
```

### Testing

```bash
# Run all tests (unit + NUTs + linting + schemas)
yarn test

# Run only unit tests
yarn test:only

# Run unit tests in watch mode
yarn test:watch

# Run NUTs (Non-Unit Tests) - integration tests against real orgs
yarn test:nuts

# Run a specific NUT
yarn mocha path/to/test.nut.ts
```

### Local Development

```bash
# Run commands via bin/dev.js, it compiles TS source on the fly (no need to run `yarn compile` after every change)
./bin/dev.js org list
```

## Architecture

### Command Structure

Commands follow oclif's file-based routing and are organized under `src/commands/org/`:

- `create/` - Create scratch orgs and sandboxes
- `delete/` - Delete scratch orgs and sandboxes
- `resume/` - Resume async org creation operations
- `refresh/` - Refresh sandboxes
- `list/` - List orgs and metadata
- `open/` - Open orgs in browser
- `enable/` and `disable/` - Manage source tracking

### Message Files

Messages are stored in `messages/*.md` files using Salesforce's message framework. Each command typically has its own message file (e.g., `create_scratch.md`, `create.sandbox.md`).

### Testing Structure

- `test/unit/` - Unit tests using Mocha + Sinon
- `test/nut/` - Integration tests (NUTs) using `@salesforce/cli-plugins-testkit`
- `test/shared/` - Tests for shared utilities
- Sandbox NUTs (`*.sandboxNut.ts`) are extremely slow and should be run selectively via GitHub Actions

### Key Dependencies

- `@oclif/core` - CLI framework
- `@salesforce/core` - Core Salesforce functionality (Org, AuthInfo, Connection, etc.)
- `@salesforce/sf-plugins-core` - Shared plugin utilities and base command classes
- `@salesforce/source-deploy-retrieve` - Metadata operations
- `@oclif/multi-stage-output` - Progress indicators for long-running operations

## Testing Notes

- Sandbox NUTs are slow due to actual org creation/refresh operations
- Use the `SandboxNuts` GitHub Action workflow instead of running locally
- Unit tests should mock `@salesforce/core` components (Org, Connection, etc.)
- NUTs use real orgs and require appropriate hub/production org authentication
