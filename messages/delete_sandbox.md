# summary

Delete a sandbox.

# description

Salesforce CLI marks the org for deletion in the production org that contains the sandbox licenses and then deletes all local references to the org from your computer.
Specify a sandbox with either the username you used when you logged into it, or the alias you gave the sandbox when you created it. Run "<%= config.bin %> org list" to view all your orgs, including sandboxes, and their aliases.
Both the sandbox and the associated production org must already be authenticated with the CLI to successfully delete the sandbox.

# examples

- Delete a sandbox with alias my-sandbox:

  <%= config.bin %> <%= command.id %> --target-org my-sandbox

- Specify a username instead of an alias:

  <%= config.bin %> <%= command.id %> --target-org myusername@example.com.qa

- Delete the sandbox without prompting to confirm:

  <%= config.bin %> <%= command.id %> --target-org my-sandbox --no-prompt

# flags.target-org.summary

Username or alias of the target org. Not required if the `target-org` configuration variable is already set.

# flags.no-prompt.summary

Don't prompt the user to confirm the deletion.

# prompt.confirm

Are you sure you want to delete the sandbox with name: %s?

# success

Successfully marked sandbox %s for deletion.

# success.Idempotent

There is no sandbox with the username %s.

# error.unknownSandbox

The org with username: %s is not known by the CLI to be a sandbox

# error.unknownSandbox.actions

Re-authenticate the sandbox with the CLI and try again.
Ensure the CLI has authenticated with the sandbox's production org.

# error.missingUsername

Unable to determine the username of the org to delete. Specify the username with the --target-org | -o flag.

# error.insufficientPermissions

You don't have the required "DeleteSandbox" Permission Set assigned in the production org to delete sandbox "%s".

# error.insufficientPermissions.actions

- Ask your administrator to create a Permission Set named "DeleteSandbox" in the production org and assign it to your user.
- Re-authenticate with the production org and try again.

# error.missingProdOrg

Unable to verify delete permissions for sandbox "%s" because the production org could not be resolved from the sandbox configuration.

# error.missingProdOrg.actions

- Ensure the production org that owns this sandbox is authenticated with the CLI using `sf org login web`.

# error.insufficientAccess

You don't have permission to delete this sandbox. Ask your Salesforce admin to grant you the "Manage Sandboxes" system permission on your profile or a permission set in the production org.
