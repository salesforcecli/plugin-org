# summary

Create a scratch org.

# description

There are two ways to create a scratch org: specify a definition file that contains the options or use the --edition flag to specify the one required option. If you want to set options other than the edition, such as org features or settings, you must use a definition file.

You must specify a Dev Hub to create a scratch org, either with the --target-dev-hub flag or by setting your default Dev Hub with the target-dev-hub configuration variable.

# examples

- Create a Developer edition scratch org using your default Dev Hub and give the scratch org an alias:

  <%= config.bin %> <%= command.id %> --edition=developer --alias my-scratch-org

- Specify the Dev Hub using its alias and a scratch org definition file. Set the scratch org as your default and specify that it expires in 3 days:

  <%= config.bin %> <%= command.id %> --target-dev-hub=MyHub --definition-file config/project-scratch-def.json --set-default --duration-days 3

# flags.target-hub.summary

Username or alias of the Dev Hub org.

# flags.target-hub.description

Overrides the value of the target-dev-hub configuration variable, if set.

# flags.alias.summary

Alias for the scratch org.

# flags.alias.description

New scratch orgs include one administrator by default. The admin user's username is auto-generated and looks something like test-wvkpnfm5z113@example.com. When you set an alias for a new scratch org, it's assigned this username.

# flags.set-default.summary

Set the scratch org as your default org

# flags.no-ancestors.summary

Don't include second-generation managed package (2GP) ancestors in the scratch org.

# flags.edition.summary

Salesforce edition of the scratch org.

# flags.async.summary

Request the org, but don't wait for it to complete.

# flags.async.description

The command immediately displays the job ID and returns control of the terminal to you. This way, you can continue to use the CLI. To resume the scratch org creation, run "<%= config.bin %> org resume scratch".

# flags.edition.description

The editions that begin with "partner-" are available only if the Dev Hub org is a Partner Business Org.

# flags.definition-file.summary

Path to a scratch org definition file.

# flags.definition-file.description

The scratch org definition file is a blueprint for the scratch org. It mimics the shape of an org that you use in the development life cycle, such as acceptance testing, packaging, or production. See <https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_def_file.htm> for all the option you can specify in the definition file.

# flags.client-id.summary

Consumer key of the Dev Hub connected app.

# flags.wait.summary

Number of minutes to wait for the scratch org to be ready.

# flags.wait.description

If the command continues to run after the wait period, the CLI returns control of the terminal to you and displays the job ID. To resume the scratch org creation, run the org resume scratch command and pass it the job ID.

# flags.track-source.summary

Use source tracking for this scratch org. Set --no-track-source to disable source tracking.

# flags.track-source.description

We recommend you enable source tracking in scratch orgs, which is why it's the default behavior. Source tracking allows you to track the changes you make to your metadata, both in your local project and in the scratch org, and to detect any conflicts between the two.

To disable source tracking in the new scratch org, specify the --no-track-source flag. The main reason to disable source tracking is for performance. For example, while you probably want to deploy metadata and run Apex tests in your CI/CD jobs, you probably don't want to incur the costs of source tracking (checking for conflicts, polling the SourceMember object, various file system operations.) This is a good use case for disabling source tracking in the scratch org.

# flags.no-namespace.summary

Create the scratch org with no namespace, even if the Dev Hub has a namespace.

# flags.duration-days.summary

Number of days before the org expires.

# prompt.secret

OAuth client secret of your personal connected app

# success

Your scratch org is ready.

# action.resume

Resume scratch org creation by running "%s org resume scratch --job-id %s"
