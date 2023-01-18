# description

list all orgs you’ve created or authenticated to

# examples

- $ <%= config.bin %> <%= command.id %>

- $ <%= config.bin %> <%= command.id %> --verbose --json

- $ <%= config.bin %> <%= command.id %> --verbose --json > tmp/MyOrgList.json

# verbose

list more information about each org

# all

include expired, deleted, and unknown-status scratch orgs

# clean

remove all local org authorizations for non-active scratch orgs. Use auth:logout to remove non-scratch orgs

# noPrompt

do not prompt for confirmation

# skipConnectionStatus

skip retrieving the connection status of non-scratch orgs

# prompt

Found (%s) org configurations to delete. Are you sure (yes/no)?

# noActiveScratchOrgs

No active scratch orgs found. Specify --all to see all scratch orgs

# deleteOrgs

You have %s expired or deleted local scratch org authorizations. To remove authorizations for inactive orgs, run org:list --clean.

# noOrgsFound

No orgs can be found.

# noOrgsFoundAction

Use one of the auth commands or org:create:scratch to add or create a scratch org.

# noResultsFound

No non-scratch orgs found.

# cleanWarning

Unable to clean org with username ${fields.username}. You can run "sfdx org:delete:scratch -o ${fields.username}" to remove it.`
