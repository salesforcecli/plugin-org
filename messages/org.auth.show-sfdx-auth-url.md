# summary

Show the SFDX Auth URL for an org.

# description

Displays the SFDX Auth URL for the specified org. The SFDX Auth URL contains a refresh token that provides persistent access to the org without requiring re-authentication. This URL is only available for orgs authenticated via a web-based OAuth flow. Because this URL is equivalent to a permanent login credential, this command prompts for confirmation before revealing it unless you pass --no-prompt or --json.

# flags.no-prompt.summary

Skip the security warning and reveal the SFDX Auth URL without confirmation.

# prompt.show-sfdx-auth-url

You are about to reveal the SFDX Auth URL for "%s". This URL contains a refresh token that grants persistent access to the org without re-authentication. Anyone with this URL can authenticate to the org with your permissions. Do you want to continue?

# warning.show-sfdx-auth-url

This command exposes a sensitive SFDX Auth URL containing a refresh token that grants persistent access to the org. Unlike an access token, this credential does not expire and allows re-authentication without user interaction. Sharing this URL is equivalent to giving permanent login access to the org. For additional information, please review https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_url.htm

# error.noRefreshToken

An SFDX Auth URL is not available for "%s". This URL is only available for orgs authenticated via a web-based login flow. Re-authenticate to the org using "sf org login web" to make it available.

# examples

- Show the SFDX Auth URL for the default org:

  <%= config.bin %> <%= command.id %>

- Show the SFDX Auth URL for a specific org:

  <%= config.bin %> <%= command.id %> --target-org my-scratch-org

- Show the SFDX Auth URL without the confirmation prompt:

  <%= config.bin %> <%= command.id %> --target-org my-scratch-org --no-prompt

- Get the SFDX Auth URL as JSON for use in scripts:

  <%= config.bin %> <%= command.id %> --target-org my-scratch-org --json
