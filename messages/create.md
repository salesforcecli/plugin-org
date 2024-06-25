# summary

Create a scratch org or sandbox.

# deprecation

The force:org:create command is deprecated and will be removed on November 6, 2024. Use "org create scratch" or "org create sandbox" instead.

# description

Creates a scratch org or a sandbox org using the values specified in a configuration file or key=value pairs that you specify on the command line. Values specified on the command line override values in the configuration file. Specify a configuration file or provide key=value pairs while creating a scratch org or a sandbox. When creating scratch orgs, —targetdevhubusername (-v) must be a Dev Hub org. When creating sandboxes, the --targetusername (-u) must be a production org with sandbox licenses. The —type (-t) is required if creating a sandbox.

# examples

- $ <%= config.bin %> <%= command.id %> -f config/enterprise-scratch-def.json -a MyScratchOrg

- $ <%= config.bin %> <%= command.id %> edition=Developer -a MyScratchOrg -s -v devHub

- $ <%= config.bin %> <%= command.id %> -f config/enterprise-scratch-def.json -a ScratchOrgWithOverrides username=testuser1@mycompany.org

- $ <%= config.bin %> <%= command.id %> -t sandbox -f config/dev-sandbox-def.json -a MyDevSandbox -u prodOrg

# flags.clientid.summary

Connected app consumer key; not supported for sandbox org creation.

# flags.setdefaultusername.summary

Set the created org as the default username.

# flags.setalias.summary

Alias for the created org.

# flags.definitionfile.summary

Path to an org definition file.

# flags.nonamespace.summary

Create the scratch org with no namespace.

# flags.noancestors.summary

Do not include second-generation package ancestors in the scratch org.

# flags.type.summary

Type of org to create.

# flags.durationdays.summary

Duration of the scratch org (in days) (default:7, min:1, max:30).

# flags.retry.summary

Number of scratch org auth retries after scratch org is successfully signed up.

# flags.wait.summary

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

The sandbox org creation process %s is in progress. Run "%s force:org:status -n %s -u %s" to check for status. If the org is ready, checking the status also authorizes the org for use with Salesforce CLI.

# requiresUsername

This command requires a username. Specify it with the -u parameter or with the "%s config set defaultusername=<username>" command.

# dnsTimeout

The sandbox was successfully created and authenticated. However, the sandbox DNS records aren't ready yet and so the sandbox may not be available. Run "%s org:list" and check if the sandbox is listed correctly. If it isn't listed, run "%s force:org:status" to view its status and, if necessary, authenticate to it again. If this issue happens frequently, try setting the SFDX_DNS_TIMEOUT environment variable to a larger number; the default value is 3 seconds.

# partialSuccess

If you specified the -a or -s parameters, but the sandbox wasn't immediately available, the "%s force:org:create" command may not have finished setting the alias or defaultusername. If so, set the alias manually with "%s alias:set" and the defaultusername with "%s config:set".

# noConfig

Please specify an org configuration via file and/or key=value pairs.

# RequiresDevhubUsernameError

This command requires a dev hub org username set either with a flag or by default in the config.

# secretPrompt

OAuth client secret of personal connected app?
