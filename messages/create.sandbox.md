# summary

Create a sandbox org.

# description

There are two ways to create a sandbox org: specify a definition file that contains the sandbox options or use the --name and --license-type flags to specify the two required options. If you want to set an option other than name or license type, such as apexClassId, you must use a definition file.

You can also use this command to clone an existing sandbox. Use the --clone flag to specify the existing sandbox name and the --name flag to the name of the new sandbox.

# examples

- Create a sandbox org using a definition file and give it the alias "MyDevSandbox". The production org that contains the sandbox license has the alias "prodOrg".

  <%= config.bin %> <%= command.id %> --definition-file config/dev-sandbox-def.json --alias MyDevSandbox --target-org prodOrg

- Create a sandbox org by directly specifying its name and type of license (Developer) instead of using a definition file. Set the sandbox org as your default.

  <%= config.bin %> <%= command.id %> --name mysandbox --license-type Developer --alias MyDevSandbox --target-org prodOrg --set-default

- Clone the existing sandbox with name "ExistingSandbox" and name the new sandbox "NewClonedSandbox". Set the new sandbox as your default org. Wait for 30 minutes for the sandbox creation to complete.

  <%= config.bin %> <%= command.id %> --clone ExistingSandbox --name NewClonedSandbox --target-org prodOrg --alias MyDevSandbox --set-default --wait 30

# flags.setDefault.summary

Set the sandbox org as your default org.

# flags.alias.summary

Alias for the sandbox org.

# flags.alias.description

When you create a sandbox, the generated usernames are based on the usernames present in the production org. To ensure uniqueness, the new usernames are appended with the name of the sandbox. For example, the username "user@example.com" in the production org results in the username "user@example.com.mysandbox" in a sandbox named "mysandbox". When you set an alias for a sandbox org, it's assigned to the resulting username of the user running this command.

# flags.targetOrg.summary

Username or alias of the production org that contains the sandbox license.

# flags.targetOrg.description

When it creates the sandbox org, Salesforce copies the metadata, and optionally data, from your production org to the new sandbox org.

# flags.definitionFile.summary

Path to a sandbox definition file.

# flags.definitionFile.description

The sandbox definition file is a blueprint for the sandbox. You can create different definition files for each sandbox type that you use in the development process. See <https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_sandbox_definition.htm> for all the options you can specify in the definition file.

# flags.name.summary

Name of the sandbox org.

# flags.name.description

The name must be a unique alphanumeric string (10 or fewer characters) to identify the sandbox. You can’t reuse a name while a sandbox is in the process of being deleted.

# flags.clone.summary

Name of the sandbox org to clone.

# flags.clone.description

The value of --clone must be an existing sandbox. The existing sandbox, and the new sandbox specified with the --name flag, must both be associated with the production org (--target-org) that contains the sandbox licenses.

# flags.licenseType.summary

Type of sandbox license.

# flags.wait.summary

Number of minutes to wait for the sandbox org to be ready.

# flags.wait.description

If the command continues to run after the wait period, the CLI returns control of the terminal to you and displays the "<%= config.bin %> org resume sandbox" command you run to check the status of the create. The displayed command includes the job ID for the running sandbox creation.

# flags.poll-interval.summary

Number of seconds to wait between retries.

# flags.async.summary

Request the sandbox creation, but don't wait for it to complete.

# flags.async.description

The command immediately displays the job ID and returns control of the terminal to you. This way, you can continue to use the CLI. To check the status of the sandbox creation, run "<%= config.bin %> org resume sandbox".

# flags.noPrompt.summary

Don't prompt for confirmation about the sandbox configuration.

# flags.no-track-source.summary

Do not use source tracking for this sandbox.

# flags.no-track-source.description

We recommend you enable source tracking in Developer and Developer Pro sandbox, which is why it's the default behavior. Source tracking allows you to track the changes you make to your metadata, both in your local project and in the sandbox, and to detect any conflicts between the two.

To disable source tracking in the new sandbox, specify the --no-track-source flag. The main reason to disable source tracking is for performance. For example, while you probably want to deploy metadata and run Apex tests in your CI/CD jobs, you probably don't want to incur the costs of source tracking (checking for conflicts, polling the SourceMember object, various file system operations.) This is a good use case for disabling source tracking in the sandbox.

# isConfigurationOk

Is the configuration correct?

# error.SandboxNameLength

The sandbox name "%s" should be 10 or fewer characters.

# error.UserNotSatisfiedWithSandboxConfig

The sandbox request configuration isn't acceptable.

# error.pollIntervalGreaterThanWait

The poll interval (%d seconds) can't be larger that wait (%d in seconds)

# error.noCloneSource

Could not find the clone sandbox name "%s" in the target org.
