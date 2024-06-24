# summary

Delete a scratch or sandbox org.

# deprecation

The force:org:delete command is deprecated and will be removed on November 6, 2024. Use "org delete scratch" or "org delete sandbox" instead.

# description

Salesforce CLI marks the org for deletion in either the Dev Hub org (for scratch orgs) or production org (for sandboxes) and then deletes all local references to the org from your computer.

To mark the org for deletion without being prompted to confirm, specify --noprompt.

# examples

- $ <%= config.bin %> <%= command.id %> -u me@my.org

- $ <%= config.bin %> <%= command.id %> -u MyOrgAlias -p

# flags.no-prompt.summary

No prompt to confirm deletion.

# missingUsername

Unable to determine the username of the org to delete. Specify the username with the --target-org | -o flag.

# flags.target-org.summary

Username or alias of the target org.

# flags.targetdevhubusername.summary

The targetdevhubusername flag exists only for backwards compatibility. It is not necessary and has no effect.

# confirmDelete

Enqueue %s org with name: %s for deletion? Are you sure (y/n)?

# sandboxConfigOnlySuccess

Successfully deleted sandbox org %s.

# ScratchOrgNotFound

Attempting to delete an expired or deleted org

# deleteOrgConfigOnlyCommandSuccess

Successfully deleted scratch org %s.'

# deleteOrgCommandSuccess

Successfully marked scratch org %s for deletion

# commandSandboxSuccess

The sandbox org %s has been successfully removed from your list of CLI authorized orgs. If you created the sandbox with
one of the force:org commands, it has also been marked for deletion.
