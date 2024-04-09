# summary

Refresh a sandbox org using the sandbox name.

# description

Refreshing a sandbox copies the metadata, and optionally data, from your source org to the refreshed sandbox org. You can optionally specify a definition file if you want to change the configuration of the refreshed sandbox, such as its license type or template ID.

You're not allowed to change the sandbox name when you refresh it with this command. If you want to change the sandbox name, first delete it with the "org delete sandbox" command. And then recreate it with the "org create sandbox" command and give it a new name.

# examples

- Refresh the sandbox named "devSbx1". The production org that contains the sandbox license has the alias "prodOrg".

  <%= config.bin %> <%= command.id %> --name devSbx1 --target-org prodOrg

- Refresh the sandbox named "devSbx2", and override the configuration of the refreshed sandbox with the properties in the specified defintion file. The default target org is the production org, so you don't need to specify the `--target-org` flag in this case.

  <%= config.bin %> <%= command.id %> --name devSbx2 --definition-file devSbx2-config.json

- Refresh the sandbox using the name defined in the definition file. The production org that contains the sandbox license has the alias "prodOrg".

  <%= config.bin %> <%= command.id %> --definition-file devSbx3-config.json --target-org prodOrg

# flags.no-auto-activate.summary

Disable auto-activation of the sandbox after a successful refresh.

# flags.no-auto-activate.description

By default, a sandbox auto-activates after a refresh. Use this flag to control sandbox activation manually.

# flags.targetOrg.summary

Username or alias of the production org that contains the sandbox license.

# flags.definitionFile.summary

Path to a sandbox definition file for overriding its configuration when you refresh it.

# flags.definitionFile.description

The sandbox definition file is a blueprint for the sandbox; use the file to change the sandbox configuration during a refresh. If you don't want to change the sandbox configuration when you refresh it, then simply use the --name flag to specify the sandbox and don't use this flag. See <https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_sandbox_definition.htm> for all the options you can specify in the definition file.

# flags.name.summary

Name of the existing sandbox org in your production org that you want to refresh.

# flags.wait.summary

Number of minutes to poll for sandbox refresh status.

# flags.wait.description

If the command continues to run after the wait period, the CLI returns control of the terminal to you and displays the "<%= config.bin %> org resume sandbox" command for you run to check the status of the refresh. The displayed command includes the job ID for the running sandbox refresh.

# flags.poll-interval.summary

Number of seconds to wait between status polling requests.

# flags.async.summary

Request the sandbox refresh, but don't wait for it to complete.

# flags.async.description

The command immediately displays the job ID and returns control of the terminal to you. This way, you can continue to use the CLI. To check the status of the sandbox refresh, run "<%= config.bin %> org resume sandbox".

# flags.noPrompt.summary

Don't prompt for confirmation about the sandbox refresh.

# isConfigurationOk

Is the configuration correct?

# error.SandboxNameLength

The sandbox name "%s" must be 10 or fewer characters.

# error.NoSandboxName

Must specify a sandbox name using the `--name` or `--definition-file` flag.

# warning.ConflictingSandboxNames

Different sandbox names were provided with the `--name` ('%s') and `--definition-file` flags ('%s'). Using the value provided by the `--name` flag. If you want to change the name of the sandbox, first delete it and then create it again using the new name.

# error.SandboxNotFound

The sandbox name "%s" could not be found in production org "%s".

# error.SandboxNotFound.actions

Ensure the sandbox name and casing is correct.
Ensure the production org for the sandbox is correct.

# error.UserNotSatisfiedWithSandboxConfig

The sandbox request configuration isn't acceptable.

# error.pollIntervalGreaterThanWait

The poll interval (%d seconds) can't be larger than the wait period (%d in seconds).

# sandboxInfoRefreshFailed

The sandbox org refresh failed with a result of %s.
