# summary

Create a scratch org or sandbox.

# deprecation

The force:org:create command is deprecated. Use org:create:scratch or org:create:sandbox.

# description

Creates a scratch org or a sandbox org using the values specified in a configuration file or key=value pairs that you specify on the command line. Values specified on the command line override values in the configuration file. Specify a configuration file or provide key=value pairs while creating a scratch org or a sandbox. When creating scratch orgs, —targetdevhubusername (-v) must be a Dev Hub org. When creating sandboxes, the --targetusername (-u) must be a production org with sandbox licenses. The —type (-t) is required if creating a sandbox.

# examples

- $ <%= config.bin %> <%= command.id %> -f config/enterprise-scratch-def.json -a MyScratchOrg

- $ <%= config.bin %> <%= command.id %> edition=Developer -a MyScratchOrg -s -v devHub

- $ <%= config.bin %> <%= command.id %> -f config/enterprise-scratch-def.json -a ScratchOrgWithOverrides username=testuser1@mycompany.org

- $ <%= config.bin %> <%= command.id %> -t sandbox -f config/dev-sandbox-def.json -a MyDevSandbox -u prodOrg

# flags.clientId

Connected app consumer key; not supported for sandbox org creation.

# flags.setDefaultUsername

Set the created org as the default username.

# flags.setAlias

Alias for the created org.

# flags.definitionFile

Path to an org definition file.

# flags.definitionJson

Org definition in JSON format.

# flags.noNamespace

Create the scratch org with no namespace.

# flags.noAncestors

Do not include second-generation package ancestors in the scratch org.

# flags.env

Environment where the scratch org is created: %s.

# flags.type

Type of org to create.

# flags.durationDays

Duration of the scratch org (in days) (default:7, min:1, max:30).

# flags.retry

Number of scratch org auth retries after scratch org is successfully signed up.

# flags.wait

Streaming client socket timeout (in minutes).

# flags.targetOrg.summary

Username or alias of the production org that contains the sandbox license.

# scratchOrgCreateSuccess

Successfully created scratch org: %s, username: %s.

# clientIdNotSupported

-i | --clientid is not supported for the sandbox org create command. Its value, %s, has been ignored.

# noNamespaceNotSupported

-n | --nonamespace is not supported for the sandbox org create command. Its value, %s, has been ignored.

# noAncestorsNotSupported

-c | --noancestors is not supported for the sandbox org create command. Its value, %s, has been ignored.

# durationDaysNotSupported

-d | --durationdays is not supported for the sandbox org create command. Its value, %s, has been ignored.

# retryIsNotValidForSandboxes

One cannot use flag retry with Sandbox org create.

# sandboxSuccess

The sandbox org creation process %s is in progress. Run "sfdx force:org:status -n %s -u %s" to check for status. If the org is ready, checking the status also authorizes the org for use with Salesforce CLI.

# requiresUsername

This command requires a username. Specify it with the -u parameter or with the "sfdx config:set defaultusername=<username>" command.

# missingLicenseType

The sandbox license type is required, but you didn't provide a value. Specify the license type in the sandbox definition file with the "licenseType" option, or specify the option as a name-value pair at the command-line. See https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_sandbox_definition.htm for more information.

# dnsTimeout

The sandbox was successfully created and authenticated. However, the sandbox DNS records aren't ready yet and so the sandbox may not be available. Run "org:list" and check if the sandbox is listed correctly. If it isn't listed, run "force:org:status" to view its status and, if necessary, authenticate to it again. If this issue happens frequently, try setting the SFDX_DNS_TIMEOUT environment variable to a larger number; the default value is 3 seconds.

# partialSuccess

If you specified the -a or -s parameters, but the sandbox wasn't immediately available, the "force:org:create" command may not have finished setting the alias or defaultusername. If so, set the alias manually with "sfdx alias:set" and the defaultusername with "sfdx config:set".

# noConfig

Please specify an org configuration via file and/or key=value pairs.

# RequiresDevhubUsernameError

This command requires a dev hub org username set either with a flag or by default in the config.

# secretPrompt

OAuth client secret of personal connected app?
