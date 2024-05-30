# summary

Delete a scratch org.

# description

Salesforce CLI marks the org for deletion in the Dev Hub org and then deletes all local references to the org from your computer.
Specify a scratch org with either the username or the alias you gave the scratch org when you created it. Run "<%= config.bin %> org list" to view all your orgs, including scratch orgs, and their aliases.

# examples

- Delete a scratch org with alias my-scratch-org:

  <%= config.bin %> <%= command.id %> --target-org my-scratch-org

- Specify a username instead of an alias:

  <%= config.bin %> <%= command.id %> --target-org test-123456-abcdefg@example.com

- Delete the scratch org without prompting to confirm :

  <%= config.bin %> <%= command.id %> --target-org my-scratch-org --no-prompt

# flags.target-org.summary

Username or alias of the target org. Not required if the `target-org` configuration variable is already set.

# flags.no-prompt.summary

Don't prompt the user to confirm the deletion.

# prompt.confirm

Are you sure you want to delete the scratch org with name: %s?

# success

Successfully marked scratch org %s for deletion.

# success.Idempotent

Successfully deleted scratch org %s.
