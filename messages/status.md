# summary

Check the status of a sandbox, and if complete, authenticate to it.

# examples

- $ <%= config.bin %> <%= command.id %> --sandboxname DevSbx1 --setalias MySandbox -u prodOrg

- $ <%= config.bin %> <%= command.id %> --sandboxname DevSbx1 --wait 45 --setdefaultusername -u prodOrg

# description

Use this command to check the status of your sandbox creation or clone and, if the sandbox is ready, authenticate to it.

Use the --wait (-w) parameter to specify the number of minutes that the command waits for the sandbox creation or clone to complete before returning control of the terminal to you.

Set the --target-org (-o) parameter to the username or alias of the production org that contains the sandbox license.

# flags.sandboxname.summary

Name of the sandbox org to check status for.

# flags.wait.summary

Number of minutes to wait while polling for status.

# flags.setdefaultusername.summary

Set the created or cloned org as your default.

# flags.setalias.summary

Alias for the created or cloned org.
