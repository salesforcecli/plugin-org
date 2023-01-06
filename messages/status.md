# examples

- $ sfdx force:org:status --sandboxname DevSbx1 --setalias MySandbox -u prodOrg

- $ sfdx force:org:status --sandboxname DevSbx1 --wait 45 --setdefaultusername -u prodOrg

# description

report status of sandbox creation or clone and authenticate to it
Use this command to check the status of your sandbox creation or clone and, if the sandbox is ready, authenticate to it.
Use the --wait (-w) parameter to specify the number of minutes that the command waits for the sandbox creation or clone to complete before returning control of the terminal to you.
Set the --targetusername (-u) parameter to the username or alias of the production org that contains the sandbox license.

# flags.sandboxname

name of the sandbox org to check status for

# flags.wait

number of minutes to wait while polling for status

# flags.setdefaultusername

set the created or cloned org as your default

# flags.setalias

alias for the created or cloned org