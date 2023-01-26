# summary

Clone a sandbox org.

# success

The sandbox org cloning process %s is in progress. Run "sfdx force:org:status -n %s" to check for status. If the org is ready, checking the status also logs the requesting user in to the sandbox org and authorizes the org for use with Salesforce CLI.

# description

There are two ways to clone a sandbox: either specify a sandbox definition file or provide key=value pairs at the command line. Key-value pairs at the command-line override their equivalent sandbox definition file values. In either case, you must specify both the "SandboxName" and "SourceSandboxName" options to set the names of the new sandbox and the one being cloned, respectively.

Set the --targetusername (-u) parameter to a production org with sandbox licenses. The --type (-t) parameter is required and must be set to "sandbox".

# examples

- $ <%= config.bin %> <%= command.id %> -t sandbox -f config/dev-sandbox-def.json -u prodOrg -a MyDevSandbox

- $ <%= config.bin %> <%= command.id %> -t sandbox SandboxName=NewClonedSandbox SourceSandboxName=ExistingSandbox -u prodOrg -a MyDevSandbox

# flags.type

Type of org to create.

# flags.wait

Number of minutes to wait while polling for status.

# flags.setdefaultusername

Set the cloned org as your default.

# flags.setalias

Alias for the cloned org.

# flags.definitionfile

Path to the sandbox definition file.

# flagsLong.wait

Sets the streaming client socket timeout, in minutes. If the streaming client socket has no contact from the server for a number of minutes, the client exits. Specify a longer wait time if timeouts occur frequently.

# commandSuccess

The sandbox org cloning process %s is in progress. Run "sfdx force:org:status -n %s" to check for status. If the org is ready, checking the status also logs the requesting user in to the sandbox org and authorizes the org for use with Salesforce CLI.

# missingLicenseType

The sandbox license type is required, but you didn't provide a value. Specify the license type in the sandbox definition file with the "licenseType" option, or specify the option as a name-value pair at the command-line. See https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_sandbox_definition.htm for more information.

# commandOrganizationTypeNotSupport

The only supported org type is: %s

# commandOrganizationTypeNotSupportAction

force:org:clone -t %s

# missingSourceSandboxName

Specify a value for %s in a definition file or on the command line.

# missingSourceSandboxNameAction

To indicate which sandbox org you want to clone, specify %s in a definition file or as a command line argument.
