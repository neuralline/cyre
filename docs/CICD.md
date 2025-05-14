# Cyre CI/CD Setup Guide

This document explains the CI/CD configuration for the Cyre project.

## Overview

The CI/CD pipeline for Cyre consists of several GitHub Actions workflows that handle:

1. Continuous Integration (testing and building)
2. Releases and publishing to npm
3. Code coverage reporting
4. Dependency updates via Dependabot

## Workflow Details

### CI Workflow (`.github/workflows/ci.yml`)

This workflow runs on:

- Pushes to main/master/develop branches
- Pull requests to main/master
- Manual triggers

It consists of two jobs:

1. **Test**:

   - Runs on multiple Node.js versions (16, 18, 20)
   - Checks out the code
   - Installs dependencies
   - Runs the test suite
   - Runs linting

2. **Build**:
   - Depends on the test job passing
   - Builds the package
   - Uploads build artifacts for inspection

### Release Workflow (`.github/workflows/release.yml`)

This workflow runs on:

- GitHub releases being created
- Manual triggers with version parameter

It handles:

- Building and testing the package
- Version bumping (for manual triggers)
- Publishing to npm

To manually trigger a release:

1. Go to Actions → Release Workflow → Run workflow
2. Select the version type (patch, minor, major) or specify a version
3. Click "Run workflow"

**Note**: This workflow requires an NPM_TOKEN secret to be configured in the repository.

### Coverage Workflow (`.github/workflows/coverage.yml`)

This workflow runs on:

- Pushes to main/master
- Pull requests to main/master
- Manual triggers

It generates code coverage reports and uploads them to Codecov.

**Note**: This workflow requires a CODECOV_TOKEN secret for uploading to Codecov.

## Additional Configuration

### Dependabot (`.github/dependabot.yml`)

Dependabot is configured to:

- Update npm dependencies weekly
- Update GitHub Actions dependencies monthly
- Group related dependencies
- Open PRs against the develop branch

### Issue Templates

- Bug report template (`.github/ISSUE_TEMPLATE/bug_report.yml`)
- Feature request template (`.github/ISSUE_TEMPLATE/feature_request.yml`)

### Pull Request Template

A pull request template (`.github/pull_request_template.md`) is provided to ensure consistent PR information.

## Setting Up Secrets

For the workflows to function properly, you need to set up these secrets:

1. `NPM_TOKEN`: For publishing to npm

   - Generate from npmjs.com → User Settings → Access Tokens
   - Add to GitHub repository: Settings → Secrets → New repository secret

2. `CODECOV_TOKEN`: For uploading coverage reports
   - Generate from codecov.io after setting up your repository
   - Add to GitHub repository: Settings → Secrets → New repository secret

## Workflow Badges

Add these badges to your README.md:

```markdown
[![CI](https://github.com/neauralline/cyre/actions/workflows/ci.yml/badge.svg)](https://github.com/neauralline/cyre/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/neauralline/cyre/branch/main/graph/badge.svg?token=your-token)](https://codecov.io/gh/neauralline/cyre)
[![npm version](https://badge.fury.io/js/cyre.svg)](https://badge.fury.io/js/cyre)
```

## Local Development

The CI/CD pipelines are designed to work with the existing npm scripts:

- `npm test`: Run tests
- `npm run lint`: Run linting
- `npm run build`: Build the package
- `npm run coverage`: Generate test coverage

Ensure these scripts are correctly defined in your package.json.
