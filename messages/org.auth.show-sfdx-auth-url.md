# summary

Show the SFDX Auth URL for an org.

# description

Shows the SFDX Auth URL for an org. This URL is only available for orgs authenticated via a web-based OAuth flow. This command prompts for confirmation before revealing it. Skip confirmation by specifying either the --no-prompt or --json flag.

# flags.no-prompt.summary

Skip the security warning and reveal the SFDX Auth URL without confirmation.

# prompt.show-sfdx-auth-url

You're about to reveal the SFDX Auth URL for "%s". This URL contains a refresh token that can be used to authenticate to the org without user interaction. Do you want to continue?

# warning.show-sfdx-auth-url

This command exposes an SFDX Auth URL. Unlike an access token, this credential contains a refresh token that allows extended access to an org. Avoid sharing or logging this URL. For additional information about org authorization, review https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_url.htm.

# error.noRefreshToken

An SFDX Auth URL is not available for "%s". This URL is only available for orgs authenticated via a web-based login flow. Re-authenticate to the org using "sf org login web" to make it available.

# examples

- Show the SFDX Auth URL for the default org:

  <%= config.bin %> <%= command.id %>

- Show the SFDX Auth URL for an org with alias "my-org":

  <%= config.bin %> <%= command.id %> --target-org my-org

- Show the SFDX Auth URL without the confirmation prompt:

  <%= config.bin %> <%= command.id %> --target-org my-org --no-prompt

- Get the SFDX Auth URL as JSON for use in scripts:

  <%= config.bin %> <%= command.id %> --target-org my-org --json
