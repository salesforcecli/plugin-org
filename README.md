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

- [`sf force:org:clone`](#sf-forceorgclone)
- [`sf force:org:create`](#sf-forceorgcreate)
- [`sf force:org:delete`](#sf-forceorgdelete)
- [`sf force:org:status`](#sf-forceorgstatus)
- [`sf org:create:sandbox`](#sf-orgcreatesandbox)
- [`sf org:create:scratch`](#sf-orgcreatescratch)
- [`sf org:delete:sandbox`](#sf-orgdeletesandbox)
- [`sf org:delete:scratch`](#sf-orgdeletescratch)
- [`sf org:display`](#sf-orgdisplay)
- [`sf org:list`](#sf-orglist)
- [`sf org:list:metadata`](#sf-orglistmetadata)
- [`sf org:list:metadata-types`](#sf-orglistmetadata-types)
- [`sf org:open`](#sf-orgopen)
- [`sf org:resume:sandbox`](#sf-orgresumesandbox)
- [`sf org:resume:scratch`](#sf-orgresumescratch)

## `sf force:org:clone`

Clone a sandbox org.

```
USAGE
  $ sf force:org:clone -o <value> -t sandbox [--json] [--api-version <value>] [-f <value>] [-s] [-a <value>] [-w
    <value>]

FLAGS
  -a, --setalias=<value>        Alias for the cloned org.
  -f, --definitionfile=<value>  Path to the sandbox definition file.
  -o, --target-org=<value>      (required) Username or alias of the target org.
  -s, --setdefaultusername      Set the cloned org as your default.
  -t, --type=<option>           (required) Type of org to create.
                                <options: sandbox>
  -w, --wait=<value>            [default: 6 minutes] Number of minutes to wait while polling for status.
  --api-version=<value>         Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Clone a sandbox org.

  There are two ways to clone a sandbox: either specify a sandbox definition file or provide key=value pairs at the
  command line. Key-value pairs at the command-line override their equivalent sandbox definition file values. In either
  case, you must specify both the "SandboxName" and "SourceSandboxName" options to set the names of the new sandbox and
  the one being cloned, respectively.

  Set the --targetusername (-u) parameter to a production org with sandbox licenses. The --type (-t) parameter is
  required and must be set to "sandbox".

EXAMPLES
  $ sf force:org:clone -t sandbox -f config/dev-sandbox-def.json -u prodOrg -a MyDevSandbox

  $ sf force:org:clone -t sandbox SandboxName=NewClonedSandbox SourceSandboxName=ExistingSandbox -u prodOrg -a MyDevSandbox

FLAG DESCRIPTIONS
  -w, --wait=<value>  Number of minutes to wait while polling for status.

    Sets the streaming client socket timeout, in minutes. If the streaming client socket has no contact from the server
    for a number of minutes, the client exits. Specify a longer wait time if timeouts occur frequently.
```

_See code: [src/commands/force/org/clone.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/force/org/clone.ts)_

## `sf force:org:create`

Create a scratch org or sandbox.

```
USAGE
  $ sf force:org:create [--json] [-o <value>] [-v <value>] [--api-version <value>] [-t scratch|sandbox] [-f <value>]
    [-n] [-c] [-i <value>] [-s] [-a <value>] [-w <value>] [-d <value>]

FLAGS
  -a, --setalias=<value>        Alias for the created org.
  -c, --noancestors             Do not include second-generation package ancestors in the scratch org.
  -d, --durationdays=<value>    [default: 7] Duration of the scratch org (in days) (default:7, min:1, max:30).
  -f, --definitionfile=<value>  Path to an org definition file.
  -i, --clientid=<value>        Connected app consumer key; not supported for sandbox org creation.
  -n, --nonamespace             Create the scratch org with no namespace.
  -o, --target-org=<value>      Username or alias of the production org that contains the sandbox license.
  -s, --setdefaultusername      Set the created org as the default username.
  -t, --type=<option>           [default: scratch] Type of org to create.
                                <options: scratch|sandbox>
  -v, --target-dev-hub=<value>  Username or alias of the Dev Hub org.
  -w, --wait=<value>            [default: 6 minutes] Streaming client socket timeout (in minutes).
  --api-version=<value>         Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Create a scratch org or sandbox.

  Creates a scratch org or a sandbox org using the values specified in a configuration file or key=value pairs that you
  specify on the command line. Values specified on the command line override values in the configuration file. Specify a
  configuration file or provide key=value pairs while creating a scratch org or a sandbox. When creating scratch orgs,
  —targetdevhubusername (-v) must be a Dev Hub org. When creating sandboxes, the --targetusername (-u) must be a
  production org with sandbox licenses. The —type (-t) is required if creating a sandbox.

EXAMPLES
  $ sf force:org:create -f config/enterprise-scratch-def.json -a MyScratchOrg

  $ sf force:org:create edition=Developer -a MyScratchOrg -s -v devHub

  $ sf force:org:create -f config/enterprise-scratch-def.json -a ScratchOrgWithOverrides username=testuser1@mycompany.org

  $ sf force:org:create -t sandbox -f config/dev-sandbox-def.json -a MyDevSandbox -u prodOrg
```

_See code: [src/commands/force/org/create.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/force/org/create.ts)_

## `sf force:org:delete`

Delete a scratch or sandbox org.

```
USAGE
  $ sf force:org:delete -o <value> [--json] [--api-version <value>] [-p]

FLAGS
  -o, --target-org=<value>  (required) Username or alias of the target org.
  -p, --no-prompt           No prompt to confirm deletion.
  --api-version=<value>     Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Delete a scratch or sandbox org.

  Salesforce CLI marks the org for deletion in either the Dev Hub org (for scratch orgs) or production org (for
  sandboxes) and then deletes all local references to the org from your computer.

  To mark the org for deletion without being prompted to confirm, specify --noprompt.

EXAMPLES
  $ sf force:org:delete -u me@my.org

  $ sf force:org:delete -u MyOrgAlias -p
```

_See code: [src/commands/force/org/delete.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/force/org/delete.ts)_

## `sf force:org:status`

Check the status of a sandbox, and if complete, authenticate to it.

```
USAGE
  $ sf force:org:status -o <value> -n <value> [--json] [--api-version <value>] [-s] [-a <value>] [-w <value>]

FLAGS
  -a, --setalias=<value>     Alias for the created or cloned org.
  -n, --sandboxname=<value>  (required) Name of the sandbox org to check status for.
  -o, --target-org=<value>   (required) Username or alias of the target org.
  -s, --setdefaultusername   Set the created or cloned org as your default.
  -w, --wait=<value>         [default: 6 minutes] Number of minutes to wait while polling for status.
  --api-version=<value>      Override the api version used for api requests made by this command

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Check the status of a sandbox, and if complete, authenticate to it.

  Use this command to check the status of your sandbox creation or clone and, if the sandbox is ready, authenticate to
  it.

  Use the --wait (-w) parameter to specify the number of minutes that the command waits for the sandbox creation or
  clone to complete before returning control of the terminal to you.

  Set the --target-org (-o) parameter to the username or alias of the production org that contains the sandbox license.

EXAMPLES
  $ sf force:org:status --sandboxname DevSbx1 --setalias MySandbox -u prodOrg

  $ sf force:org:status --sandboxname DevSbx1 --wait 45 --setdefaultusername -u prodOrg
```

_See code: [src/commands/force/org/status.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/force/org/status.ts)_

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

_See code: [src/commands/org/create/sandbox.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/org/create/sandbox.ts)_

## `sf org:create:scratch`

Create a scratch org.

```
USAGE
  $ sf org:create:scratch -v <value> [--json] [-a <value>] [--async] [-d] [-f <value>] [-c] [-e
    developer|enterprise|group|professional|partner-developer|partner-enterprise|partner-group|partner-professional]
    [-m] [-y <value>] [-w <value>] [--api-version <value>] [-i <value>] [-t] [--username <value>] [--description
    <value>] [--name <value>] [--release preview|previous] [--admin-email <value>] [--source-org <value>]

FLAGS
  -a, --alias=<value>            Alias for the scratch org.
  -d, --set-default              Set the scratch org as your default org
  -f, --definition-file=<value>  Path to a scratch org definition file.
  -i, --client-id=<value>        Consumer key of the Dev Hub connected app.
  -t, --[no-]track-source        Use source tracking for this scratch org. Set --no-track-source to disable source
                                 tracking.
  -v, --target-dev-hub=<value>   (required) Username or alias of the Dev Hub org.
  -w, --wait=<minutes>           [default: 5 minutes] Number of minutes to wait for the scratch org to be ready.
  -y, --duration-days=<days>     [default: 7 days] Number of days before the org expires.
  --api-version=<value>          Override the api version used for api requests made by this command
  --async                        Request the org, but don't wait for it to complete.

PACKAGING FLAGS
  -c, --no-ancestors  Don't include second-generation managed package (2GP) ancestors in the scratch org.
  -m, --no-namespace  Create the scratch org with no namespace, even if the Dev Hub has a namespace.

DEFINITION FILE OVERRIDE FLAGS
  -e, --edition=<option>  Salesforce edition of the scratch org. Overrides the value of the "edition" option in the
                          definition file, if set.
                          <options: developer|enterprise|group|professional|partner-developer|partner-enterprise|partner
                          -group|partner-professional>
  --admin-email=<value>   Email address that will be applied to the org's admin user. Overrides the value of the
                          "adminEmail" option in the definition file, if set.
  --description=<value>   Description of the scratch org in the Dev Hub. Overrides the value of the "description" option
                          in the definition file, if set.
  --name=<value>          Name of the org, such as "Acme Company". Overrides the value of the "orgName" option in the
                          definition file, if set.
  --release=<option>      Release of the scratch org as compared to the Dev Hub release.
                          <options: preview|previous>
  --source-org=<value>    15-character ID of the org whose shape the new scratch org will be based on. Overrides the
                          value of the "sourceOrg" option in the definition file, if set.
  --username=<value>      Username of the scratch org admin user. Overrides the value of the "username" option in the
                          definition file, if set.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Create a scratch org.

  There are two ways to create a scratch org: either specify a definition file that contains the options or use the
  --edition flag to specify the one required option.

  For either method, you can also use these flags; if you use them with --definition-file, they override their
  equivalent option in the scratch org definition file:

  * --description
  * --name  (equivalent to the "orgName" option)
  * --username
  * --release
  * --edition
  * --admin-email (equivalent to the "adminEmail" option)
  * --source-org (equivalent to the "sourceOrg" option)

  If you want to set options other than the preceding ones, such as org features or settings, you must use a definition
  file.

  You must specify a Dev Hub to create a scratch org, either with the --target-dev-hub flag or by setting your default
  Dev Hub with the target-dev-hub configuration variable.

ALIASES
  $ sf env:create:scratch

EXAMPLES
  Create a Developer edition scratch org using your default Dev Hub and give the scratch org an alias:

    $ sf org:create:scratch --edition developer --alias my-scratch-org

  Create a scratch org with a definition file. Specify the Dev Hub using its alias, set the scratch org as your
  default, and specify that it expires in 3 days:

    $ sf org:create:scratch --target-dev-hub MyHub --definition-file config/project-scratch-def.json --set-default \
      --duration-days 3

  Create a preview Enterprise edition scratch org; for use only during Salesforce release transition periods:

    $ sf org:create:scratch --edition enterprise --alias my-scratch-org --target-dev-hub MyHub --release preview

FLAG DESCRIPTIONS
  -a, --alias=<value>  Alias for the scratch org.

    New scratch orgs include one administrator by default. The admin user's username is auto-generated and looks
    something like test-wvkpnfm5z113@example.com. When you set an alias for a new scratch org, it's assigned this
    username.

  -e, --edition=developer|enterprise|group|professional|partner-developer|partner-enterprise|partner-group|partner-professional

    Salesforce edition of the scratch org. Overrides the value of the "edition" option in the definition file, if set.

    The editions that begin with "partner-" are available only if the Dev Hub org is a Partner Business Org.

  -f, --definition-file=<value>  Path to a scratch org definition file.

    The scratch org definition file is a blueprint for the scratch org. It mimics the shape of an org that you use in
    the development life cycle, such as acceptance testing, packaging, or production. See
    <https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_def_file.htm> for
    all the option you can specify in the definition file.

  -t, --[no-]track-source  Use source tracking for this scratch org. Set --no-track-source to disable source tracking.

    We recommend you enable source tracking in scratch orgs, which is why it's the default behavior. Source tracking
    allows you to track the changes you make to your metadata, both in your local project and in the scratch org, and to
    detect any conflicts between the two.

    To disable source tracking in the new scratch org, specify the --no-track-source flag. The main reason to disable
    source tracking is for performance. For example, while you probably want to deploy metadata and run Apex tests in
    your CI/CD jobs, you probably don't want to incur the costs of source tracking (checking for conflicts, polling the
    SourceMember object, various file system operations.) This is a good use case for disabling source tracking in the
    scratch org.

  -v, --target-dev-hub=<value>  Username or alias of the Dev Hub org.

    Overrides the value of the target-dev-hub configuration variable, if set.

  -w, --wait=<minutes>  Number of minutes to wait for the scratch org to be ready.

    If the command continues to run after the wait period, the CLI returns control of the terminal to you and displays
    the job ID. To resume the scratch org creation, run the org resume scratch command and pass it the job ID.

  --async  Request the org, but don't wait for it to complete.

    The command immediately displays the job ID and returns control of the terminal to you. This way, you can continue
    to use the CLI. To resume the scratch org creation, run "sf org resume scratch".

  --release=preview|previous  Release of the scratch org as compared to the Dev Hub release.

    By default, scratch orgs are on the same release as the Dev Hub. During Salesforce release transition periods, you
    can override this default behavior and opt in or out of the new release.

  --username=<value>

    Username of the scratch org admin user. Overrides the value of the "username" option in the definition file, if set.

    The username must be unique within the entire scratch org and sandbox universe. You must add your own logic to
    ensure uniqueness.

    Omit this flag to have Salesforce generate a unique username for your org.
```

_See code: [src/commands/org/create/scratch.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/org/create/scratch.ts)_

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

_See code: [src/commands/org/delete/sandbox.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/org/delete/sandbox.ts)_

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

_See code: [src/commands/org/delete/scratch.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/org/delete/scratch.ts)_

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

_See code: [src/commands/org/display.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/org/display.ts)_

## `sf org:list`

List all orgs you’ve created or authenticated to.

```
USAGE
  $ sf org:list [--json] [--verbose] [--all] [-p --clean] [--skip-connection-status]

FLAGS
  -p, --no-prompt           Don't prompt for confirmation.
  --all                     Include expired, deleted, and unknown-status scratch orgs.
  --clean                   Remove all local org authorizations for non-active scratch orgs. Use "org logout" to remove
                            non-scratch orgs.
  --skip-connection-status  Skip retrieving the connection status of non-scratch orgs.
  --verbose                 List more information about each org.

GLOBAL FLAGS
  --json  Format output as json.

ALIASES
  $ sf force:org:list

EXAMPLES
  List all orgs you've created or authenticated to:

    $ sf org:list

  List all orgs, including expired, deleted, and unknown-status orgs; don't include the connection status:

    $ sf org:list --skip-connection-status --all

  List orgs and remove local org authorization info about non-active scratch orgs:

    $ sf org:list --clean
```

_See code: [src/commands/org/list.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/org/list.ts)_

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

_See code: [src/commands/org/list/metadata.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/org/list/metadata.ts)_

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

_See code: [src/commands/org/list/metadata-types.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/org/list/metadata-types.ts)_

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

    $ sf org:open --source-file force-app/main/default/flexipages/Hello.flexipage-meta.xml

  Open a local Flow in Flow Builder:

    $ sf org:open --source-file force-app/main/default/flows/Hello.flow-meta.xml
```

_See code: [src/commands/org/open.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/org/open.ts)_

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

_See code: [src/commands/org/resume/sandbox.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/org/resume/sandbox.ts)_

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

_See code: [src/commands/org/resume/scratch.ts](https://github.com/salesforcecli/plugin-org/blob/2.11.8/src/commands/org/resume/scratch.ts)_

<!-- commandsstop -->
