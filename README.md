# plugin-org

[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-org.svg?label=@salesforce/plugin-org)](https://www.npmjs.com/package/@salesforce/plugin-org) [![CircleCI](https://circleci.com/gh/salesforcecli/plugin-org/tree/main.svg?style=shield)](https://circleci.com/gh/salesforcecli/plugin-org/tree/main) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-org.svg)](https://npmjs.org/package/@salesforce/plugin-org) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/plugin-org/main/LICENSE.txt)

Commands for working with Salesforce orgs. As the Salesforce CLI is transitioning commands owned by various teams to open source, it may not represent all of the `org` commands.

## About Salesforce CLI plugins

Salesforce CLI plugins are based on the [oclif plugin framework](<(https://oclif.io/docs/introduction.html)>). Read the [plugin developer guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_plugins.meta/sfdx_cli_plugins/cli_plugins_architecture_sf_cli.htm) to learn about Salesforce CLI plugin development.

This repository contains a lot of additional scripts and tools to help with general Salesforce node development and enforce coding standards. You should familiarize yourself with some of the [node developer packages](https://github.com/forcedotcom/sfdx-dev-packages/) used by Salesforce. There is also a default circleci config using the [release management orb](https://github.com/forcedotcom/npm-release-management-orb) standards.

Additionally, there are some additional tests that the Salesforce CLI will enforce if this plugin is ever bundled with the CLI. These test are included by default under the `posttest` script and it is recommended to keep these tests active in your plugin, regardless if you plan to have it bundled.

This plugin is bundled with the [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli). For more information on the CLI, read the [getting started guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm).

We always recommend using the latest version of these commands bundled with the CLI, however, you can install a specific version or tag if needed.

## Install

```bash
sfdx plugins:install @salesforce/plugin-org
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
5. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing using a fork.
6. Edit the code in your fork.
7. Write appropriate tests for your changes. Try to achieve at least 95% code coverage on any new code. No pull request will be accepted without unit tests.
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

To use your plugin, run using the local `./bin/run` or `./bin/run.cmd` file.

```bash
# Run using local run file.
./bin/run force:org:list
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sfdx cli
sfdx plugins:link .
# To verify
sfdx plugins
```

## Commands

<!-- commands -->
* [`sfdx force:org:display [-u <string>] [--apiversion <string>] [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-forceorgdisplay--u-string---apiversion-string---verbose---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx force:org:list [--all] [-p --clean] [--skipconnectionstatus] [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-forceorglist---all--p---clean---skipconnectionstatus---verbose---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx force:org:open [-p <string>] [-r] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-forceorgopen--p-string--r--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx force:org:display [-u <string>] [--apiversion <string>] [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

get the description for the current or target org

```
USAGE
  $ sfdx force:org:display [-u <string>] [--apiversion <string>] [--verbose] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --verbose                                                                         emit additional command output to
                                                                                    stdout

DESCRIPTION
  Output includes your access token, client Id, connected status, org ID, instance URL, username, and alias, if 
  applicable.
  Use --verbose to include the SFDX auth URL.
  Including --verbose displays the sfdxAuthUrl property only if you authenticated to the org using auth:web:login (not 
  auth:jwt:grant)

EXAMPLES
  sfdx force:org:display
  sfdx force:org:display -u me@my.org
  sfdx force:org:display -u TestOrg1 --json
  sfdx force:org:display -u TestOrg1 --json > tmp/MyOrgDesc.json
```

_See code: [src/commands/force/org/display.ts](https://github.com/salesforcecli/plugin-org/blob/v1.6.9/src/commands/force/org/display.ts)_

## `sfdx force:org:list [--all] [-p --clean] [--skipconnectionstatus] [--verbose] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

list all orgs you’ve created or authenticated to

```
USAGE
  $ sfdx force:org:list [--all] [-p --clean] [--skipconnectionstatus] [--verbose] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -p, --noprompt                                                                    do not prompt for confirmation

  --all                                                                             include expired, deleted, and
                                                                                    unknown-status scratch orgs

  --clean                                                                           remove all local org authorizations
                                                                                    for non-active orgs

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

  --skipconnectionstatus                                                            skip retrieving the connection
                                                                                    status of non-scratch orgs

  --verbose                                                                         list more information about each
                                                                                    org'

EXAMPLES
  sfdx force:org:list
  sfdx force:org:list --verbose --json
  sfdx force:org:list --verbose --json > tmp/MyOrgList.json
```

_See code: [src/commands/force/org/list.ts](https://github.com/salesforcecli/plugin-org/blob/v1.6.9/src/commands/force/org/list.ts)_

## `sfdx force:org:open [-p <string>] [-r] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

open your default scratch org, or another specified org

```
USAGE
  $ sfdx force:org:open [-p <string>] [-r] [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -p, --path=path                                                                   navigation URL path

  -r, --urlonly                                                                     display navigation URL, but don’t
                                                                                    launch browser

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

DESCRIPTION
  To open a specific page, specify the portion of the URL after "yourInstance.salesforce.com/" as --path.
  For example, specify "--path lightning" to open Lightning Experience, or specify "--path /apex/YourPage" to open a 
  Visualforce page.
  To generate a URL but not launch it in your browser, specify --urlonly.

EXAMPLES
  sfdx force:org:open
  sfdx force:org:open -u me@my.org
  sfdx force:org:open -u MyTestOrg1
  sfdx force:org:open -r -p lightning
```

_See code: [src/commands/force/org/open.ts](https://github.com/salesforcecli/plugin-org/blob/v1.6.9/src/commands/force/org/open.ts)_
<!-- commandsstop -->
