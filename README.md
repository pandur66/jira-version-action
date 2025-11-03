# jira-version-action

A GitHub Action that creates Versions in a Jira Cloud project using the Jira REST API.

This action calls the Jira Cloud REST API to create a Version object for a given project. It is
implemented in TypeScript and bundled to a single `dist/index.js` artifact for publishing.

## Installation

You can use this action in your workflows by referencing it from the GitHub Marketplace:

```yaml
- uses: pandur66/jira-version-action@v1
```

For more details and examples, see the [GitHub repository](https://github.com/pandur66/jira-version-action).

## Features

- Create a Jira Version via `/rest/api/3/version`.
- Masks sensitive inputs (API token and user email) using `core.setSecret` to avoid leaking secrets in logs.
- Retries on HTTP 429 (rate limit) using exponential backoff.

## Inputs

| Input | Required | Description |
|---|:---:|---|
| `jira-base-url` | yes | Base URL of your Jira Cloud instance, e.g. `https://your-domain.atlassian.net`. |
| `jira-project-key` | yes | Jira project key, e.g. `MYPROJ`. |
| `jira-user-email` | yes | Jira user email used for Basic Auth. Keep this in secrets if possible. |
| `jira-api-token` | yes | Jira API token. Store this in GitHub Secrets. |
| `version-name` | yes | Version name to create in Jira, e.g. `v1.2.0`. |
| `version-description` | no | Optional description for the version. |
| `released` | no | Whether the version should be marked as released (`true`/`false`). Default: `false`. |
| `check-if-exists` | no | If `true`, checks if version exists before creating it. Returns existing version info if found. Default: `false`. |

## Outputs

| Output | Description |
|---|---|
| `version-id` | ID of the created Jira version. |
| `version-url` | `self` URL returned by the Jira API for the created version. |

## Usage (GitHub Actions)

Example workflow using this action:

```yaml
name: Create Jira Version

on:
  workflow_dispatch:

jobs:
  create-version:
    runs-on: ubuntu-latest
    steps:
      - name: Create Jira version
        id: create_version
        uses: pandur66/jira-version-action@v1
        with:
          jira-base-url: https://company.atlassian.net
          jira-project-key: MYPROJ
          jira-user-email: ${{ secrets.JIRA_USER_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
          version-name: "v1.2.0"
          version-description: "Release v1.2.0"
          released: false
          check-if-exists: true

      - name: Show created version info
        run: |
          echo "Version ID: ${{ steps.create_version.outputs.version-id }}"
          echo "Version URL: ${{ steps.create_version.outputs.version-url }}"
```

## Local development

To run the action locally (TypeScript compiled or using the bundled file), set the corresponding `INPUT_` environment variables and run Node:

```bash
export INPUT_JIRA_BASE_URL="https://your-domain.atlassian.net"
export INPUT_JIRA_USER_EMAIL="you@example.com"
export INPUT_JIRA_API_TOKEN="your_api_token"
export INPUT_VERSION_NAME="v1.2.0"
# run compiled action
node dist/index.js
```

Note: GitHub Actions converts input names to environment variables by uppercasing and replacing dashes with underscores, so `version-name` becomes `INPUT_VERSION_NAME`.

## Best practices

- Always store `jira-api-token` and `jira-user-email` in GitHub Secrets and avoid printing them.
- If you receive frequent 429 responses, space runs or limit the number of requests to respect Jira rate limits.

## Development & publishing

- The action targets Node 20 (see `action.yml`), compiles TypeScript into `dist/`, and bundles a single file using `@vercel/ncc` for publishing.
- CI is configured to run lint and build on PRs and pushes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. To contribute:

1. Fork the repository at https://github.com/pandur66/jira-version-action
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Note: CI will automatically run lint and build checks on your PR.

## License

MIT — Author: Bruno Ferreira
