# summary

Delete a scratch org.

# description

Specify a scratch org with either the username you used when you logged into it with "sf login", or the alias you gave the scratch org when you created it. Run "sf env list" to view all your environments, including scratch orgs, and their aliases.

# examples

- Delete a scratch org with alias my-scratch-org:

  <%= config.bin %> <%= command.id %> --target-org=my-scratch-org

- Specify a username instead of an alias:

  <%= config.bin %> <%= command.id %> --target-org=test-123456-abcdefg@example.com

- Delete the scratch org without prompting to confirm :

  <%= config.bin %> <%= command.id %> --target-org=my-scratch-org --no-prompt

# flags.target-org.summary

Scratch org alias or login user.

# flags.no-prompt.summary

Don't prompt the user to confirm the deletion.

# prompt.confirm

Are you sure you want to delete the scratch org with name: %s?

# success

Successfully marked scratch org %s for deletion.

# success.Idempotent

Successfully deleted scratch org %s.
