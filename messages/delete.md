# summary

Delete a scratch or sandbox org.

# deprecation

The force:org:delete command is deprecated. Use org:delete:scratch or org:delete:sandbox.

# description

Deleting a scratch or sandbox org is a two-part process. Salesforce CLI first deletes all local references to the org from your computer. It then it marks the org for deletion in either the Dev Hub org (for scratch orgs) or production org (for sandboxes.)

To mark the org for deletion without being prompted to confirm, specify --noprompt.

# examples

- $ <%= config.bin %> <%= command.id %> -u me@my.org

- $ <%= config.bin %> <%= command.id %> -u MyOrgAlias -p

# flags.noprompt

No prompt to confirm deletion.

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

The sandbox org %s has been successfully removed from your list of CLI authorized orgs. If you created the sandbox with one of the force:org commands, it has also been marked for deletion.
