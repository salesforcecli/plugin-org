# sandboxSuccess

The sandbox org %s was successful.

# sandboxSuccess.actions

The username for the sandbox is %s.
You can open the org by running "%s org open -o %s"

# checkSandboxStatus

Run "%s org resume sandbox --job-id %s -o %s" to check for status.
If the org is ready, checking the status also authorizes the org for use with Salesforce CLI.

# warning.ClientTimeoutWaitingForSandboxProcess

The wait time for the sandbox %s has been exhausted. See the results below for more information.

# warning.MultipleMatchingSandboxProcesses

We found multiple sandbox processes for "%s" in a resumable state. We're ignoring the sandbox process ID(s) "%s" in status(es) "%s" and using the most recent process ID "%s". To resume a different sandbox process, use that unique sandbox process ID with the command. For example, "sf org resume sandbox --job-id %s -o %s".
