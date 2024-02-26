# summary

Refresh (update) a sandbox org by the sandbox name.

# description

Refresh (update) a sandbox org by the sandbox name, using a definition file for any `SandboxInfo` overrides.

Note that changing a sandbox name during a refresh is not allowed. If changing the sandbox name is desired, instead delete the sandbox and recreate it.

# examples

- Refresh the sandbox named "devSbx1". The production org that contains the sandbox license has the alias "prodOrg".

  <%= config.bin %> <%= command.id %> -n devSbx1 --target-org prodOrg

- Refresh the sandbox named "devSbx2", overriding the SandboxInfo used when created with the properties in a definition file. The default target org is the production org, so specifying the `--target-org` flag is not necessary in this case.

  <%= config.bin %> <%= command.id %> -n devSbx2 -f devSbx2-config.json

- Refresh the sandbox using the name defined in the definition file. The production org that contains the sandbox license has the alias "prodOrg".

  <%= config.bin %> <%= command.id %> --definition-file devSbx3-config.json -o prodOrg

# flags.auto-activate.summary

[default: true] Activates the sandbox after successful refresh.

# flags.auto-activate.description

[default: true] Activates the sandbox after successful refresh.

# flags.targetOrg.summary

Username or alias of the production org that contains the sandbox license.

# flags.targetOrg.description

When it refreshes the sandbox org, Salesforce copies the metadata, and optionally data, from your production org to the sandbox org.

# flags.definitionFile.summary

Path to a sandbox definition file used to override the configuration used when created.

# flags.definitionFile.description

The sandbox definition file is a blueprint for the sandbox, and is used to change the configuration during a refresh. If no configuration changes from the sandbox creation are desired then simply target the sandbox org using the `--name` flag. See <https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_sandbox_definition.htm> for all the options you can specify in the definition file.

# flags.name.summary

Name of the existing sandbox org in your production org.

# flags.name.description

Name of the existing sandbox org in your production org.

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

Don't prompt for confirmation about the sandbox configuration.

# isConfigurationOk

Is the configuration correct?

# error.SandboxNameLength

The sandbox name "%s" should be 10 or fewer characters.

# error.NoSandboxName

Must specify a sandbox name using the `--name` or `--definition-file` flag.

# warning.ConflictingSandboxNames

Different sandbox names were provided with the `--name` ('%s') and `--definition-file` flags ('%s'). Using the value provided by the `--name` flag. If you want to change the name of the sandbox, please delete and create using the new name.

# error.SandboxNotFound

The sandbox name "%s" could not be found in production org "%s".

# error.SandboxNotFound.actions

Ensure the sandbox name and casing is correct.
Ensure the production org for the sandbox is correct.

# error.UserNotSatisfiedWithSandboxConfig

The sandbox request configuration isn't acceptable.

# error.pollIntervalGreaterThanWait

The poll interval (%d seconds) can't be larger that wait (%d in seconds)

# sandboxInfoRefreshFailed

The sandbox org refresh failed with a result of %s.
