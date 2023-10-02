# sandboxSuccess

The sandbox org creation was successful.

# sandboxSuccess.actions

The username for the sandbox is %s.
You can open the org by running "%s org open -o %s"

# checkSandboxStatus

Run "%s org resume sandbox --job-id %s -o %s" to check for status.
If the org is ready, checking the status also authorizes the org for use with Salesforce CLI.

# warning.ClientTimeoutWaitingForSandboxCreate

The wait time for the sandbox creation has been exhausted. Please see the results below for more information.

# warning.MultipleMatchingSandboxProcesses

There were multiple sandbox processes found for "%s" in a resumable state. Ignoring sandbox process ID(s) "%s" in status(es) "%s" and using the most recent process ID "%s". To resume a different sandbox process please use that unique sandbox process ID with the command. E.g, "sf org resume sandbox --job-id %s -o %s"
