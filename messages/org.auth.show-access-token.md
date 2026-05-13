# summary

Show the current access token for an org.

# description

Because access tokens are sensitive credentials that grant full access to an org, this command prompts for confirmation before revealing the token. Skip confirmation by specifying either the --no-prompt or --json flag.

# flags.no-prompt.summary

Skip the security warning and reveal the access token without confirmation.

# prompt.show-access-token

You're about to reveal the access token for "%s". This token grants full access to the org with your current permissions. Sharing or logging this token is equivalent to sharing your credentials. Do you want to continue?

# warning.show-access-token

This command exposes a sensitive Access Token that allows for subsequent activity using your current authenticated session. Sharing this information is equivalent to logging someone in under the current credential, resulting in unintended access and escalation of privilege. For additional information about org authorization, please review https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth.htm.

# error.noAccessToken

No access token found for "%s". The org may need to be re-authenticated.

# examples

- Show the access token for the default org:

  <%= config.bin %> <%= command.id %>

- Show the access token for an org with alias "my-org":

  <%= config.bin %> <%= command.id %> --target-org my-org

- Show the access token without the confirmation prompt:

  <%= config.bin %> <%= command.id %> --target-org my-org --no-prompt

- Get the access token as JSON for use in scripts:

  <%= config.bin %> <%= command.id %> --target-org my-org --json
