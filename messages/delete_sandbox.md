# summary

Delete a sandbox.

# description

Specify a sandbox with either the username you used when you logged into it with "sf login", or the alias you gave the sandbox when you created it. Run "sf env list" to view all your environments, including sandboxes, and their aliases.

# examples

- Delete a sandbox with alias my-sandbox:

  <%= config.bin %> <%= command.id %> --target-org=my-sandbox

- Specify a username instead of an alias:

  <%= config.bin %> <%= command.id %> --target-org=myusername@example.com.qa

- Delete the sandbox without prompting to confirm :

  <%= config.bin %> <%= command.id %> --target-org=my-sandbox --no-prompt

# flags.target-org.summary

Sandbox alias or login user.

# flags.no-prompt.summary

Don't prompt the user to confirm the deletion.

# prompt.confirm

Are you sure you want to delete the sandbox with name: %s?

# success

Successfully marked sandbox %s for deletion.

# success.Idempotent

There is no sandbox with the username %s.

# error.isNotSandbox

The target org, %s, is not a sandbox.
