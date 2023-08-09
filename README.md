# plugin-org

[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-org.svg?label=@salesforce/plugin-org)](https://www.npmjs.com/package/@salesforce/plugin-org) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-org.svg)](https://npmjs.org/package/@salesforce/plugin-org) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/plugin-org/main/LICENSE.txt)

Commands for working with Salesforce orgs. As the Salesforce CLI is transitioning commands owned by various teams to
open source, it may not represent all of the `org` commands.

## About Salesforce CLI plugins

Salesforce CLI plugins are based on the [oclif plugin framework](<(https://oclif.io/docs/introduction.html)>). Read
the [plugin developer guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_plugins.meta/sfdx_cli_plugins/cli_plugins_architecture_sf_cli.htm)
to learn about Salesforce CLI plugin development.

This repository contains a lot of additional scripts and tools to help with general Salesforce node development and
enforce coding standards. You should familiarize yourself with some of
the [node developer packages](https://github.com/forcedotcom/sfdx-dev-packages/) used by Salesforce. There is also a
default circleci config using the [release management orb](https://github.com/forcedotcom/npm-release-management-orb)
standards.

Additionally, there are some additional tests that the Salesforce CLI will enforce if this plugin is ever bundled with
the CLI. These test are included by default under the `posttest` script and it is recommended to keep these tests active
in your plugin, regardless if you plan to have it bundled.

This plugin is bundled with the [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli). For more information
on the CLI, read
the [getting started guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm).

We always recommend using the latest version of these commands bundled with the CLI, however, you can install a specific
version or tag if needed.

## Install

```bash
sf plugins:install @salesforce/plugin-org
```

## Issues

Please report any issues at <https://github.com/forcedotcom/cli/issues>

## Contributing

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md)
2. Create a new issue before starting your project so that we can keep track of
   what you are trying to add/fix. That way, we can also offer suggestions or
   let you know if there is already an effort in progress.
3. Fork this repository.
4. [Build the plugin locally](#build)
5. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing
   using a fork.
6. Edit the code in your fork.
7. Write appropriate tests for your changes. Try to achieve at least 95% code coverage on any new code. No pull request
   will be accepted without unit tests.
8. Sign CLA (see [CLA](#cla) below).
9. Send us a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in.

### CLA

External contributors will be required to sign a Contributor's License
Agreement. You can do so by going to <https://cla.salesforce.com/sign-cla>.

### Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:salesforcecli/plugin-org

# Install the dependencies and compile
yarn install
yarn build
```

To use your plugin, run using the local `./bin/dev` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev force:org:list
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be
useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sf cli
sf plugins:link .
# To verify
sf plugins
```

### Sandbox NUTs

Sandboxes are pretty slow, and there's a constraint to how many we can have. So if your changes might impact sandboxes,
and you want to check those in the real world, run
the [SandboxNuts](https://github.com/salesforcecli/plugin-org/actions/workflows/sandboxNuts.yml) Github Action.

## Commands

<!-- commands -->

- [`sf env:create:sandbox`](#sf-envcreatesandbox)
- [`sf env:delete:sandbox`](#sf-envdeletesandbox)
- [`sf env:delete:scratch`](#sf-envdeletescratch)
- [`sf env:resume:sandbox`](#sf-envresumesandbox)
- [`sf env:resume:scratch`](#sf-envresumescratch)
- [`sf force:mdapi:describemetadata`](#sf-forcemdapidescribemetadata)
- [`sf force:mdapi:listmetadata`](#sf-forcemdapilistmetadata)
- [`sf force:org:display`](#sf-forceorgdisplay)
- [`sf force:org:open`](#sf-forceorgopen)
- [`sf force:source:open`](#sf-forcesourceopen)
- [`sf org:create:sandbox`](#sf-orgcreatesandbox)
- [`sf org:delete:sandbox`](#sf-orgdeletesandbox)
- [`sf org:delete:scratch`](#sf-orgdeletescratch)
- [`sf org:display`](#sf-orgdisplay)
- [`sf org:list:metadata`](#sf-orglistmetadata)
- [`sf org:list:metadata-types`](#sf-orglistmetadata-types)
- [`sf org:open`](#sf-orgopen)
- [`sf org:resume:sandbox`](#sf-orgresumesandbox)
- [`sf org:resume:scratch`](#sf-orgresumescratch)

## `sf env:create:sandbox`

Create a sandbox org.

```
USAGE
  $ sf env:create:sandbox -o <value> [--json] [-f <value> | -n <value> | -l Developer|Developer_Pro|Partial|Full] [-s]
    [-a <value>] [-w <value> | --async] [-i <value> | ] [-c <value> | ] [--no-prompt] [--no-track-source]

FLAGS
  -a, --alias=<value>            Alias for the sandbox org.
  -c, --clone=<value>            Name of the sandbox org to clone.
  -f, --definition-file=<value>  Path to a sandbox definition file.
  -i, --poll-interval=<seconds>  [default: 30 seconds] Number of seconds to wait between retries.
  -l, --license-type=<option>    Type of sandbox license.
                                 <options: Developer|Developer_Pro|Partial|Full>
  -n, --name=<value>             Name of the sandbox org.
  -o, --target-org=<value>       (required) Username or alias of the production org that contains the sandbox license.
  -s, --set-default              Set the sandbox org as your default org.
  -w, --wait=<minutes>           [default: 30 minutes] Number of minutes to wait for the sandbox org to be ready.
  --async                        Request the sandbox creation, but don't wait for it to complete.
  --no-prompt                    Don't prompt for confirmation about the sandbox configuration.
  --no-track-source              Do not use source tracking for this sandbox.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Create a sandbox org.

  There are two ways to create a sandbox org: specify a definition file that contains the sandbox options or use the
  --name and --license-type flags to specify the two required options. If you want to set an option other than name or
  license type, such as apexClassId, you must use a definition file.

ALIASES
  $ sf env:create:sandbox

EXAMPLES
  Create a sandbox org using a definition file and give it the alias "MyDevSandbox". The production org that contains
  the sandbox license has the alias "prodOrg".

    $ sf env:create:sandbox -f config/dev-sandbox-def.json --alias MyDevSandbox --target-org prodOrg

  Create a sandbox org by directly specifying its name and type of license (Developer) instead of using a definition
  file. Set the sandbox org as your default.

    $ sf env:create:sandbox --name mysandbox --license-type Developer --alias MyDevSandbox --target-org prodOrg \
      --set-default

FLAG DESCRIPTIONS
  -a, --alias=<value>  Alias for the sandbox org.

    When you create a sandbox, the generated usernames are based on the usernames present in the production org. To
    ensure uniqueness, the new usernames are appended with the name of the sandbox. For example, the username
    "user@example.com" in the production org results in the username "user@example.com.mysandbox" in a sandbox named
    "mysandbox". When you set an alias for a sandbox org, it's assigned to the resulting username of the user running
    this command.

  -c, --clone=<value>  Name of the sandbox org to clone.

    The value of clone must be an existing sandbox in the same target-org.

  -f, --definition-file=<value>  Path to a sandbox definition file.

    The sandbox definition file is a blueprint for the sandbox. You can create different definition files for each
    sandbox type that you use in the development process. See
    <https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_sandbox_definition.htm> for all
    the options you can specify in the defintion file.

  -n, --name=<value>  Name of the sandbox org.

    The name must be a unique alphanumeric string (10 or fewer characters) to identify the sandbox. You can’t reuse a
    name while a sandbox is in the process of being deleted.

  -o, --target-org=<value>  Username or alias of the production org that contains the sandbox license.

    When it creates the sandbox org, Salesforce copies the metadata, and optionally data, from your production org to
    the new sandbox org.

  -w, --wait=<minutes>  Number of minutes to wait for the sandbox org to be ready.

    If the command continues to run after the wait period, the CLI returns control of the terminal to you and displays
    the "sf org resume sandbox" command you run to check the status of the create. The displayed command includes the
    job ID for the running sandbox creation.

  --async  Request the sandbox creation, but don't wait for it to complete.

    The command immediately displays the job ID and returns control of the terminal to you. This way, you can continue
    to use the CLI. To check the status of the sandbox creation, run "sf org resume sandbox".

  --no-track-source  Do not use source tracking for this sandbox.

    We recommend you enable source tracking in Developer and Developer Pro sandbox, which is why it's the default
    behavior. Source tracking allows you to track the changes you make to your metadata, both in your local project and
    in the sandbox, and to detect any conflicts between the two.

    To disable source tracking in the new sandbox, specify the --no-track-source flag. The main reason to disable source
    tracking is for performance. For example, while you probably want to deploy metadata and run Apex tests in your
    CI/CD jobs, you probably don't want to incur the costs of source tracking (checking for conflicts, polling the
    SourceMember object, various file system operations.) This is a good use case for disabling source tracking in the
    sandbox.
```

## `sf env:delete:sandbox`

Delete a sandbox.

```
USAGE
  $ sf env:delete:sandbox -o <value> [--json] [-p]

FLAGS
  -o, --target-org=<value>  (required) Sandbox alias or login user.
  -p, --no-prompt           Don't prompt the user to confirm the deletion.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Delete a sandbox.

  Salesforce CLI marks the org for deletion in the production org that contains the sandbox licenses and then deletes
  all local references to the org from your computer.
  Specify a sandbox with either the username you used when you logged into it, or the alias you gave the sandbox when
  you created it. Run "sf org list" to view all your orgs, including sandboxes, and their aliases.

ALIASES
  $ sf env:delete:sandbox

EXAMPLES
  Delete a sandbox with alias my-sandbox:

    $ sf env:delete:sandbox --target-org my-sandbox

  Specify a username instead of an alias:

    $ sf env:delete:sandbox --target-org myusername@example.com.qa

  Delete the sandbox without prompting to confirm :

    $ sf env:delete:sandbox --target-org my-sandbox --no-prompt
```

## `sf env:delete:scratch`

Delete a scratch org.

```
USAGE
  $ sf env:delete:scratch -o <value> [--json] [-p]

FLAGS
  -o, --target-org=<value>  (required) Scratch org alias or login user.
  -p, --no-prompt           Don't prompt the user to confirm the deletion.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Delete a scratch org.

  Salesforce CLI marks the org for deletion in the Dev Hub org and then deletes all local references to the org from
  your computer.
  Specify a scratch org with either the username or the alias you gave the scratch org when you created it. Run "sf org
  list" to view all your orgs, including scratch orgs, and their aliases.

ALIASES
  $ sf env:delete:scratch

EXAMPLES
  Delete a scratch org with alias my-scratch-org:

    $ sf env:delete:scratch --target-org my-scratch-org

  Specify a username instead of an alias:

    $ sf env:delete:scratch --target-org test-123456-abcdefg@example.com

  Delete the scratch org without prompting to confirm :

    $ sf env:delete:scratch --target-org my-scratch-org --no-prompt
```

## `sf env:resume:sandbox`

Check the status of a sandbox creation, and log in to it if it's ready.

```
USAGE
  $ sf env:resume:sandbox [--json] [-w <value>] [-n <value> | -i <value>] [-l] [-o <value>]

FLAGS
  -i, --job-id=<value>      Job ID of the incomplete sandbox creation that you want to check the status of.
  -l, --use-most-recent     Use the most recent sandbox create request.
  -n, --name=<value>        Name of the sandbox org.
  -o, --target-org=<value>  Username or alias of the production org that contains the sandbox license.
  -w, --wait=<minutes>      Number of minutes to wait for the sandbox org to be ready.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Check the status of a sandbox creation, and log in to it if it's ready.

  Sandbox creation can take a long time. If the original "sf org create sandbox" command either times out, or you
  specified the --async flag, the command displays a job ID. Use this job ID to check whether the sandbox creation is
  complete, and if it is, the command then logs into it.

  You can also use the sandbox name to check the status or the --use-most-recent flag to use the job ID of the most
  recent sandbox creation.

ALIASES
  $ sf env:resume:sandbox

EXAMPLES
  Check the status of a sandbox creation using its name and specify a production org with alias "prodOrg":

    $ sf env:resume:sandbox --name mysandbox --target-org prodOrg

  Check the status using the job ID:

    $ sf env:resume:sandbox --job-id 0GRxxxxxxxx

  Check the status of the most recent sandbox create request:

    $ sf env:resume:sandbox --use-most-recent

FLAG DESCRIPTIONS
  -i, --job-id=<value>  Job ID of the incomplete sandbox creation that you want to check the status of.

    The job ID is valid for 24 hours after you start the sandbox creation.

  -o, --target-org=<value>  Username or alias of the production org that contains the sandbox license.

    When it creates the sandbox org, Salesforce copies the metadata, and optionally data, from your production org to
    the new sandbox org.

  -w, --wait=<minutes>  Number of minutes to wait for the sandbox org to be ready.

    If the command continues to run after the wait period, the CLI returns control of the terminal window to you and
    returns the job ID. To resume checking the sandbox creation, rerun this command.
```

## `sf env:resume:scratch`

Resume the creation of an incomplete scratch org.

```
USAGE
  $ sf env:resume:scratch [--json] [-i <value>] [-r]

FLAGS
  -i, --job-id=<value>   Job ID of the incomplete scratch org create that you want to resume.
  -r, --use-most-recent  Use the job ID of the most recent incomplete scratch org.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Resume the creation of an incomplete scratch org.

  When the original "sf org create scratch" command either times out or is run with the --async flag, it displays a job
  ID.

  Run this command by either passing it a job ID or using the --use-most-recent flag to specify the most recent
  incomplete scratch org.

ALIASES
  $ sf env:resume:scratch

EXAMPLES
  Resume a scratch org create with a job ID:

    $ sf env:resume:scratch --job-id 2SR3u0000008fBDGAY

  Resume your most recent incomplete scratch org:

    $ sf env:resume:scratch --use-most-recent

FLAG DESCRIPTIONS
  -i, --job-id=<value>  Job ID of the incomplete scratch org create that you want to resume.

    The job ID is the same as the record ID of the incomplete scratch org in the ScratchOrgInfo object of the Dev Hub.

    The job ID is valid for 24 hours after you start the scratch org creation.
```

## `sf force:mdapi:describemetadata`

Display details about the metadata types that are enabled for your org.

```
USAGE
  $ sf force:mdapi:describemetadata -o <value> [--json] [--api-version <value>] [-f <value>]

FLAGS
  -f, --output-file=<value>  Pathname of the file in which to write the results.
  -o, --target-org=<value>   (required) Username or alias of the target org.
  --api-version=<value>      API version to use; default is the most recent API version.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Display details about the metadata types that are enabled for your org.

  The information includes Apex classes and triggers, custom objects, custom fields on standard objects, tab sets that
  define an app, and many other metadata types. Use this information to identify the syntax needed for a <name> element
  in a manifest file (package.xml).

  The username that you use to connect to the org must have the Modify All Data or Modify Metadata Through Metadata API
  Functions permission.

ALIASES
  $ sf force:mdapi:describemetadata

EXAMPLES
  Display information about all known and enabled metadata types in the org with alias "my-dev-org" using API version
  57.0:

    $ sf force:mdapi:describemetadata --api-version 57.0 --target-org my-dev-org

  Display only the metadata types that aren't yet supported by Salesforce CLI in your default org and write the
  results to the specified file:

    $ sf force:mdapi:describemetadata --output-file /path/to/outputfilename.txt --filter-known

FLAG DESCRIPTIONS
  -f, --output-file=<value>  Pathname of the file in which to write the results.

    Directing the output to a file makes it easier to extract relevant information for your package.xml manifest file.
    The default output destination is the terminal or command window console.

  --api-version=<value>  API version to use; default is the most recent API version.

    Override the api version used for api requests made by this command
```

## `sf force:mdapi:listmetadata`

List the metadata components and properties of a specified type.

```
USAGE
  $ sf force:mdapi:listmetadata -o <value> -m <value> [--json] [--api-version <value>] [-f <value>] [--folder <value>]

FLAGS
  -f, --output-file=<value>    Pathname of the file in which to write the results.
  -m, --metadata-type=<value>  (required) Metadata type to be retrieved, such as CustomObject; metadata type names are
                               case-sensitive.
  -o, --target-org=<value>     (required) Username or alias of the target org.
  --api-version=<value>        API version to use; default is the most recent API version.
  --folder=<value>             Folder associated with the component; required for components that use folders; folder
                               names are case-sensitive.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List the metadata components and properties of a specified type.

  Use this command to identify individual components in your manifest file or if you want a high-level view of
  particular metadata types in your org. For example, you can use this command to return a list of names of all the
  CustomObject or Layout components in your org, then use this information in a retrieve command that returns a subset
  of these components.

  The username that you use to connect to the org must have the Modify All Data or Modify Metadata Through Metadata API
  Functions permission.

ALIASES
  $ sf force:mdapi:listmetadata

EXAMPLES
  List the CustomObject components, and their properties, in the org with alias "my-dev-org":

    $ sf force:mdapi:listmetadata --metadata-type CustomObject --target-org my-dev-org

  List the CustomObject components in your default org, write the output to the specified file, and use API version
  57.0:

    $ sf force:mdapi:listmetadata --metadata-type CustomObject --api-version 57.0 --output-file \
      /path/to/outputfilename.txt

  List the Dashboard components in your default org that are contained in the "folderSales" folder, write the output
  to the specified file, and use API version 57.0:

    $ sf force:mdapi:listmetadata --metadata-type Dashboard --folder folderSales --api-version 57.0 --output-file \
      /path/to/outputfilename.txt

FLAG DESCRIPTIONS
  --api-version=<value>  API version to use; default is the most recent API version.

    Override the api version used for api requests made by this command

  --folder=<value>

    Folder associated with the component; required for components that use folders; folder names are case-sensitive.

    Examples of metadata types that use folders are Dashboard, Document, EmailTemplate, and Report.
```

## `sf force:org:display`

Display information about an org.

```
USAGE
  $ sf force:org:display -o <value> [--json] [--api-version <value>] [--verbose]

FLAGS
  -o, --target-org=<value>  (required) Username or alias of the target org.
  --api-version=<value>     Override the api version used for api requests made by this command
  --verbose                 Display the sfdxAuthUrl property.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Display information about an org.

  Output includes your access token, client Id, connected status, org ID, instance URL, username, and alias, if
  applicable.

  Use --verbose to include the SFDX auth URL. WARNING: The SFDX auth URL contains sensitive information, such as a
  refresh token that can be used to access an org. Don't share or distribute this URL or token.

  Including --verbose displays the sfdxAuthUrl property only if you authenticated to the org using "org login web" (not
  "org login jwt").

ALIASES
  $ sf force:org:display

EXAMPLES
  Display information about your default org:

    $ sf force:org:display

  Display information, including the sfdxAuthUrl property, about the org with alias TestOrg1:

    $ sf force:org:display --target-org TestOrg1 --verbose
```

## `sf force:org:open`

Open your default scratch org, or another specified org, in a browser.

```
USAGE
  $ sf force:org:open -o <value> [--json] [--api-version <value>] [-b chrome|edge|firefox | -r] [-p <value> | -f
    <value>]

FLAGS
  -b, --browser=<option>     Browser where the org opens.
                             <options: chrome|edge|firefox>
  -f, --source-file=<value>  Path to an ApexPage or FlexiPage to open in Lightning App Builder.
  -o, --target-org=<value>   (required) Username or alias of the target org.
  -p, --path=<value>         Navigation URL path to open a specific page.
  -r, --url-only             Display navigation URL, but don’t launch browser.
  --api-version=<value>      Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Open your default scratch org, or another specified org, in a browser.

  To open a specific page, specify the portion of the URL after "https://MyDomainName.my.salesforce.com/" as the value
  for the --path flag. For example, specify "--path lightning" to open Lightning Experience, or specify "--path
  /apex/YourPage" to open a Visualforce page.

  Use the --source-file to open a Lightning Page from your local project in Lightning App Builder. Lightning page files
  have the suffix .flexipage-meta.xml, and are stored in the "flexipages" directory.

  To generate a URL but not launch it in your browser, specify --url-only.

  To open in a specific browser, use the --browser flag. Supported browsers are "chrome", "edge", and "firefox". If you
  don't specify --browser, the org opens in your default browser.

ALIASES
  $ sf force:org:open
  $ sf force:source:open

EXAMPLES
  Open your default org in your default browser:

    $ sf force:org:open

  Open the org with alias MyTestOrg1 in the Firefox browser:

    $ sf force:org:open --target-org MyTestOrg1 --browser firefox

  Display the navigation URL for the Lightning Experience page for your default org, but don't open the page in a
  browser:

    $ sf force:org:open --url-only --path lightning

  Open a local Lightning page in your default org's Lightning App Builder:

    $ sf force:org:open --source-path force-app/main/default/flexipages/Hello.flexipage-meta.xml
```

## `sf force:source:open`

Open your default scratch org, or another specified org, in a browser.

```
USAGE
  $ sf force:source:open -o <value> [--json] [--api-version <value>] [-b chrome|edge|firefox | -r] [-p <value> | -f
    <value>]

FLAGS
  -b, --browser=<option>     Browser where the org opens.
                             <options: chrome|edge|firefox>
  -f, --source-file=<value>  Path to an ApexPage or FlexiPage to open in Lightning App Builder.
  -o, --target-org=<value>   (required) Username or alias of the target org.
  -p, --path=<value>         Navigation URL path to open a specific page.
  -r, --url-only             Display navigation URL, but don’t launch browser.
  --api-version=<value>      Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Open your default scratch org, or another specified org, in a browser.

  To open a specific page, specify the portion of the URL after "https://MyDomainName.my.salesforce.com/" as the value
  for the --path flag. For example, specify "--path lightning" to open Lightning Experience, or specify "--path
  /apex/YourPage" to open a Visualforce page.

  Use the --source-file to open a Lightning Page from your local project in Lightning App Builder. Lightning page files
  have the suffix .flexipage-meta.xml, and are stored in the "flexipages" directory.

  To generate a URL but not launch it in your browser, specify --url-only.

  To open in a specific browser, use the --browser flag. Supported browsers are "chrome", "edge", and "firefox". If you
  don't specify --browser, the org opens in your default browser.

ALIASES
  $ sf force:org:open
  $ sf force:source:open

EXAMPLES
  Open your default org in your default browser:

    $ sf force:source:open

  Open the org with alias MyTestOrg1 in the Firefox browser:

    $ sf force:source:open --target-org MyTestOrg1 --browser firefox

  Display the navigation URL for the Lightning Experience page for your default org, but don't open the page in a
  browser:

    $ sf force:source:open --url-only --path lightning

  Open a local Lightning page in your default org's Lightning App Builder:

    $ sf force:source:open --source-path force-app/main/default/flexipages/Hello.flexipage-meta.xml
```

## `sf org:create:sandbox`

Create a sandbox org.

```
USAGE
  $ sf org:create:sandbox -o <value> [--json] [-f <value> | -n <value> | -l Developer|Developer_Pro|Partial|Full] [-s]
    [-a <value>] [-w <value> | --async] [-i <value> | ] [-c <value> | ] [--no-prompt] [--no-track-source]

FLAGS
  -a, --alias=<value>            Alias for the sandbox org.
  -c, --clone=<value>            Name of the sandbox org to clone.
  -f, --definition-file=<value>  Path to a sandbox definition file.
  -i, --poll-interval=<seconds>  [default: 30 seconds] Number of seconds to wait between retries.
  -l, --license-type=<option>    Type of sandbox license.
                                 <options: Developer|Developer_Pro|Partial|Full>
  -n, --name=<value>             Name of the sandbox org.
  -o, --target-org=<value>       (required) Username or alias of the production org that contains the sandbox license.
  -s, --set-default              Set the sandbox org as your default org.
  -w, --wait=<minutes>           [default: 30 minutes] Number of minutes to wait for the sandbox org to be ready.
  --async                        Request the sandbox creation, but don't wait for it to complete.
  --no-prompt                    Don't prompt for confirmation about the sandbox configuration.
  --no-track-source              Do not use source tracking for this sandbox.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Create a sandbox org.

  There are two ways to create a sandbox org: specify a definition file that contains the sandbox options or use the
  --name and --license-type flags to specify the two required options. If you want to set an option other than name or
  license type, such as apexClassId, you must use a definition file.

ALIASES
  $ sf env:create:sandbox

EXAMPLES
  Create a sandbox org using a definition file and give it the alias "MyDevSandbox". The production org that contains
  the sandbox license has the alias "prodOrg".

    $ sf org:create:sandbox -f config/dev-sandbox-def.json --alias MyDevSandbox --target-org prodOrg

  Create a sandbox org by directly specifying its name and type of license (Developer) instead of using a definition
  file. Set the sandbox org as your default.

    $ sf org:create:sandbox --name mysandbox --license-type Developer --alias MyDevSandbox --target-org prodOrg \
      --set-default

FLAG DESCRIPTIONS
  -a, --alias=<value>  Alias for the sandbox org.

    When you create a sandbox, the generated usernames are based on the usernames present in the production org. To
    ensure uniqueness, the new usernames are appended with the name of the sandbox. For example, the username
    "user@example.com" in the production org results in the username "user@example.com.mysandbox" in a sandbox named
    "mysandbox". When you set an alias for a sandbox org, it's assigned to the resulting username of the user running
    this command.

  -c, --clone=<value>  Name of the sandbox org to clone.

    The value of clone must be an existing sandbox in the same target-org.

  -f, --definition-file=<value>  Path to a sandbox definition file.

    The sandbox definition file is a blueprint for the sandbox. You can create different definition files for each
    sandbox type that you use in the development process. See
    <https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_sandbox_definition.htm> for all
    the options you can specify in the defintion file.

  -n, --name=<value>  Name of the sandbox org.

    The name must be a unique alphanumeric string (10 or fewer characters) to identify the sandbox. You can’t reuse a
    name while a sandbox is in the process of being deleted.

  -o, --target-org=<value>  Username or alias of the production org that contains the sandbox license.

    When it creates the sandbox org, Salesforce copies the metadata, and optionally data, from your production org to
    the new sandbox org.

  -w, --wait=<minutes>  Number of minutes to wait for the sandbox org to be ready.

    If the command continues to run after the wait period, the CLI returns control of the terminal to you and displays
    the "sf org resume sandbox" command you run to check the status of the create. The displayed command includes the
    job ID for the running sandbox creation.

  --async  Request the sandbox creation, but don't wait for it to complete.

    The command immediately displays the job ID and returns control of the terminal to you. This way, you can continue
    to use the CLI. To check the status of the sandbox creation, run "sf org resume sandbox".

  --no-track-source  Do not use source tracking for this sandbox.

    We recommend you enable source tracking in Developer and Developer Pro sandbox, which is why it's the default
    behavior. Source tracking allows you to track the changes you make to your metadata, both in your local project and
    in the sandbox, and to detect any conflicts between the two.

    To disable source tracking in the new sandbox, specify the --no-track-source flag. The main reason to disable source
    tracking is for performance. For example, while you probably want to deploy metadata and run Apex tests in your
    CI/CD jobs, you probably don't want to incur the costs of source tracking (checking for conflicts, polling the
    SourceMember object, various file system operations.) This is a good use case for disabling source tracking in the
    sandbox.
```

_See code: [src/commands/org/create/sandbox.ts](https://github.com/salesforcecli/plugin-org/blob/v2.9.28/src/commands/org/create/sandbox.ts)_

## `sf org:delete:sandbox`

Delete a sandbox.

```
USAGE
  $ sf org:delete:sandbox -o <value> [--json] [-p]

FLAGS
  -o, --target-org=<value>  (required) Sandbox alias or login user.
  -p, --no-prompt           Don't prompt the user to confirm the deletion.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Delete a sandbox.

  Salesforce CLI marks the org for deletion in the production org that contains the sandbox licenses and then deletes
  all local references to the org from your computer.
  Specify a sandbox with either the username you used when you logged into it, or the alias you gave the sandbox when
  you created it. Run "sf org list" to view all your orgs, including sandboxes, and their aliases.

ALIASES
  $ sf env:delete:sandbox

EXAMPLES
  Delete a sandbox with alias my-sandbox:

    $ sf org:delete:sandbox --target-org my-sandbox

  Specify a username instead of an alias:

    $ sf org:delete:sandbox --target-org myusername@example.com.qa

  Delete the sandbox without prompting to confirm :

    $ sf org:delete:sandbox --target-org my-sandbox --no-prompt
```

_See code: [src/commands/org/delete/sandbox.ts](https://github.com/salesforcecli/plugin-org/blob/v2.9.28/src/commands/org/delete/sandbox.ts)_

## `sf org:delete:scratch`

Delete a scratch org.

```
USAGE
  $ sf org:delete:scratch -o <value> [--json] [-p]

FLAGS
  -o, --target-org=<value>  (required) Scratch org alias or login user.
  -p, --no-prompt           Don't prompt the user to confirm the deletion.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Delete a scratch org.

  Salesforce CLI marks the org for deletion in the Dev Hub org and then deletes all local references to the org from
  your computer.
  Specify a scratch org with either the username or the alias you gave the scratch org when you created it. Run "sf org
  list" to view all your orgs, including scratch orgs, and their aliases.

ALIASES
  $ sf env:delete:scratch

EXAMPLES
  Delete a scratch org with alias my-scratch-org:

    $ sf org:delete:scratch --target-org my-scratch-org

  Specify a username instead of an alias:

    $ sf org:delete:scratch --target-org test-123456-abcdefg@example.com

  Delete the scratch org without prompting to confirm :

    $ sf org:delete:scratch --target-org my-scratch-org --no-prompt
```

_See code: [src/commands/org/delete/scratch.ts](https://github.com/salesforcecli/plugin-org/blob/v2.9.28/src/commands/org/delete/scratch.ts)_

## `sf org:display`

Display information about an org.

```
USAGE
  $ sf org:display -o <value> [--json] [--api-version <value>] [--verbose]

FLAGS
  -o, --target-org=<value>  (required) Username or alias of the target org.
  --api-version=<value>     Override the api version used for api requests made by this command
  --verbose                 Display the sfdxAuthUrl property.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Display information about an org.

  Output includes your access token, client Id, connected status, org ID, instance URL, username, and alias, if
  applicable.

  Use --verbose to include the SFDX auth URL. WARNING: The SFDX auth URL contains sensitive information, such as a
  refresh token that can be used to access an org. Don't share or distribute this URL or token.

  Including --verbose displays the sfdxAuthUrl property only if you authenticated to the org using "org login web" (not
  "org login jwt").

ALIASES
  $ sf force:org:display

EXAMPLES
  Display information about your default org:

    $ sf org:display

  Display information, including the sfdxAuthUrl property, about the org with alias TestOrg1:

    $ sf org:display --target-org TestOrg1 --verbose
```

_See code: [src/commands/org/display.ts](https://github.com/salesforcecli/plugin-org/blob/v2.9.28/src/commands/org/display.ts)_

## `sf org:list:metadata`

List the metadata components and properties of a specified type.

```
USAGE
  $ sf org:list:metadata -o <value> -m <value> [--json] [--api-version <value>] [-f <value>] [--folder <value>]

FLAGS
  -f, --output-file=<value>    Pathname of the file in which to write the results.
  -m, --metadata-type=<value>  (required) Metadata type to be retrieved, such as CustomObject; metadata type names are
                               case-sensitive.
  -o, --target-org=<value>     (required) Username or alias of the target org.
  --api-version=<value>        API version to use; default is the most recent API version.
  --folder=<value>             Folder associated with the component; required for components that use folders; folder
                               names are case-sensitive.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List the metadata components and properties of a specified type.

  Use this command to identify individual components in your manifest file or if you want a high-level view of
  particular metadata types in your org. For example, you can use this command to return a list of names of all the
  CustomObject or Layout components in your org, then use this information in a retrieve command that returns a subset
  of these components.

  The username that you use to connect to the org must have the Modify All Data or Modify Metadata Through Metadata API
  Functions permission.

ALIASES
  $ sf force:mdapi:listmetadata

EXAMPLES
  List the CustomObject components, and their properties, in the org with alias "my-dev-org":

    $ sf org:list:metadata --metadata-type CustomObject --target-org my-dev-org

  List the CustomObject components in your default org, write the output to the specified file, and use API version
  57.0:

    $ sf org:list:metadata --metadata-type CustomObject --api-version 57.0 --output-file /path/to/outputfilename.txt

  List the Dashboard components in your default org that are contained in the "folderSales" folder, write the output
  to the specified file, and use API version 57.0:

    $ sf org:list:metadata --metadata-type Dashboard --folder folderSales --api-version 57.0 --output-file \
      /path/to/outputfilename.txt

FLAG DESCRIPTIONS
  --api-version=<value>  API version to use; default is the most recent API version.

    Override the api version used for api requests made by this command

  --folder=<value>

    Folder associated with the component; required for components that use folders; folder names are case-sensitive.

    Examples of metadata types that use folders are Dashboard, Document, EmailTemplate, and Report.
```

_See code: [src/commands/org/list/metadata.ts](https://github.com/salesforcecli/plugin-org/blob/v2.9.28/src/commands/org/list/metadata.ts)_

## `sf org:list:metadata-types`

Display details about the metadata types that are enabled for your org.

```
USAGE
  $ sf org:list:metadata-types -o <value> [--json] [--api-version <value>] [-f <value>]

FLAGS
  -f, --output-file=<value>  Pathname of the file in which to write the results.
  -o, --target-org=<value>   (required) Username or alias of the target org.
  --api-version=<value>      API version to use; default is the most recent API version.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Display details about the metadata types that are enabled for your org.

  The information includes Apex classes and triggers, custom objects, custom fields on standard objects, tab sets that
  define an app, and many other metadata types. Use this information to identify the syntax needed for a <name> element
  in a manifest file (package.xml).

  The username that you use to connect to the org must have the Modify All Data or Modify Metadata Through Metadata API
  Functions permission.

ALIASES
  $ sf force:mdapi:describemetadata

EXAMPLES
  Display information about all known and enabled metadata types in the org with alias "my-dev-org" using API version
  57.0:

    $ sf org:list:metadata-types --api-version 57.0 --target-org my-dev-org

  Display only the metadata types that aren't yet supported by Salesforce CLI in your default org and write the
  results to the specified file:

    $ sf org:list:metadata-types --output-file /path/to/outputfilename.txt --filter-known

FLAG DESCRIPTIONS
  -f, --output-file=<value>  Pathname of the file in which to write the results.

    Directing the output to a file makes it easier to extract relevant information for your package.xml manifest file.
    The default output destination is the terminal or command window console.

  --api-version=<value>  API version to use; default is the most recent API version.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/org/list/metadata-types.ts](https://github.com/salesforcecli/plugin-org/blob/v2.9.28/src/commands/org/list/metadata-types.ts)_

## `sf org:open`

Open your default scratch org, or another specified org, in a browser.

```
USAGE
  $ sf org:open -o <value> [--json] [--api-version <value>] [-b chrome|edge|firefox | -r] [-p <value> | -f
    <value>]

FLAGS
  -b, --browser=<option>     Browser where the org opens.
                             <options: chrome|edge|firefox>
  -f, --source-file=<value>  Path to an ApexPage or FlexiPage to open in Lightning App Builder.
  -o, --target-org=<value>   (required) Username or alias of the target org.
  -p, --path=<value>         Navigation URL path to open a specific page.
  -r, --url-only             Display navigation URL, but don’t launch browser.
  --api-version=<value>      Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Open your default scratch org, or another specified org, in a browser.

  To open a specific page, specify the portion of the URL after "https://MyDomainName.my.salesforce.com/" as the value
  for the --path flag. For example, specify "--path lightning" to open Lightning Experience, or specify "--path
  /apex/YourPage" to open a Visualforce page.

  Use the --source-file to open a Lightning Page from your local project in Lightning App Builder. Lightning page files
  have the suffix .flexipage-meta.xml, and are stored in the "flexipages" directory.

  To generate a URL but not launch it in your browser, specify --url-only.

  To open in a specific browser, use the --browser flag. Supported browsers are "chrome", "edge", and "firefox". If you
  don't specify --browser, the org opens in your default browser.

ALIASES
  $ sf force:org:open
  $ sf force:source:open

EXAMPLES
  Open your default org in your default browser:

    $ sf org:open

  Open the org with alias MyTestOrg1 in the Firefox browser:

    $ sf org:open --target-org MyTestOrg1 --browser firefox

  Display the navigation URL for the Lightning Experience page for your default org, but don't open the page in a
  browser:

    $ sf org:open --url-only --path lightning

  Open a local Lightning page in your default org's Lightning App Builder:

    $ sf org:open --source-path force-app/main/default/flexipages/Hello.flexipage-meta.xml
```

_See code: [src/commands/org/open.ts](https://github.com/salesforcecli/plugin-org/blob/v2.9.28/src/commands/org/open.ts)_

## `sf org:resume:sandbox`

Check the status of a sandbox creation, and log in to it if it's ready.

```
USAGE
  $ sf org:resume:sandbox [--json] [-w <value>] [-n <value> | -i <value>] [-l] [-o <value>]

FLAGS
  -i, --job-id=<value>      Job ID of the incomplete sandbox creation that you want to check the status of.
  -l, --use-most-recent     Use the most recent sandbox create request.
  -n, --name=<value>        Name of the sandbox org.
  -o, --target-org=<value>  Username or alias of the production org that contains the sandbox license.
  -w, --wait=<minutes>      Number of minutes to wait for the sandbox org to be ready.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Check the status of a sandbox creation, and log in to it if it's ready.

  Sandbox creation can take a long time. If the original "sf org create sandbox" command either times out, or you
  specified the --async flag, the command displays a job ID. Use this job ID to check whether the sandbox creation is
  complete, and if it is, the command then logs into it.

  You can also use the sandbox name to check the status or the --use-most-recent flag to use the job ID of the most
  recent sandbox creation.

ALIASES
  $ sf env:resume:sandbox

EXAMPLES
  Check the status of a sandbox creation using its name and specify a production org with alias "prodOrg":

    $ sf org:resume:sandbox --name mysandbox --target-org prodOrg

  Check the status using the job ID:

    $ sf org:resume:sandbox --job-id 0GRxxxxxxxx

  Check the status of the most recent sandbox create request:

    $ sf org:resume:sandbox --use-most-recent

FLAG DESCRIPTIONS
  -i, --job-id=<value>  Job ID of the incomplete sandbox creation that you want to check the status of.

    The job ID is valid for 24 hours after you start the sandbox creation.

  -o, --target-org=<value>  Username or alias of the production org that contains the sandbox license.

    When it creates the sandbox org, Salesforce copies the metadata, and optionally data, from your production org to
    the new sandbox org.

  -w, --wait=<minutes>  Number of minutes to wait for the sandbox org to be ready.

    If the command continues to run after the wait period, the CLI returns control of the terminal window to you and
    returns the job ID. To resume checking the sandbox creation, rerun this command.
```

_See code: [src/commands/org/resume/sandbox.ts](https://github.com/salesforcecli/plugin-org/blob/v2.9.28/src/commands/org/resume/sandbox.ts)_

## `sf org:resume:scratch`

Resume the creation of an incomplete scratch org.

```
USAGE
  $ sf org:resume:scratch [--json] [-i <value>] [-r]

FLAGS
  -i, --job-id=<value>   Job ID of the incomplete scratch org create that you want to resume.
  -r, --use-most-recent  Use the job ID of the most recent incomplete scratch org.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Resume the creation of an incomplete scratch org.

  When the original "sf org create scratch" command either times out or is run with the --async flag, it displays a job
  ID.

  Run this command by either passing it a job ID or using the --use-most-recent flag to specify the most recent
  incomplete scratch org.

ALIASES
  $ sf env:resume:scratch

EXAMPLES
  Resume a scratch org create with a job ID:

    $ sf org:resume:scratch --job-id 2SR3u0000008fBDGAY

  Resume your most recent incomplete scratch org:

    $ sf org:resume:scratch --use-most-recent

FLAG DESCRIPTIONS
  -i, --job-id=<value>  Job ID of the incomplete scratch org create that you want to resume.

    The job ID is the same as the record ID of the incomplete scratch org in the ScratchOrgInfo object of the Dev Hub.

    The job ID is valid for 24 hours after you start the scratch org creation.
```

_See code: [src/commands/org/resume/scratch.ts](https://github.com/salesforcecli/plugin-org/blob/v2.9.28/src/commands/org/resume/scratch.ts)_

<!-- commandsstop -->
