# summary

List all orgs you’ve created or authenticated to.

# examples

- List all orgs you've created or authenticated to:

  $ <%= config.bin %> <%= command.id %>

- List all orgs, including expired, deleted, and unknown-status orgs; don't include the connection status:

  $ <%= config.bin %> <%= command.id %> --skip-connection-status --all

- List orgs and remove local org authorization info about non-active scratch orgs:

  $ <%= config.bin %> <%= command.id %> --clean

# flags.verbose.summary

List more information about each org.

# flags.all.summary

Include expired, deleted, and unknown-status scratch orgs.

# flags.clean.summary

Remove all local org authorizations for non-active scratch orgs. Use "org logout" to remove non-scratch orgs.

# flags.no-prompt.summary

Don't prompt for confirmation.

# flags.skip-connection-status.summary

Skip retrieving the connection status of non-scratch orgs.

# prompt

Found (%s) org configurations to delete. Are you sure (yes/no)?

# noActiveScratchOrgs

No active scratch orgs found. Specify --all to see all scratch orgs.

# deleteOrgs

You have %s expired or deleted local scratch org authorizations. To remove authorizations for inactive orgs, run "org list --clean".

# noOrgsFound

No orgs can be found.

# noOrgsFoundAction

Use one of the "org login" commands or "org create scratch" to add or create a scratch org.

# noResultsFound

No Orgs found.

# cleanWarning

Unable to clean org with username %s. You can run "%s org delete scratch -o %s" to remove it.`
