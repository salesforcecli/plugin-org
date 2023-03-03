# description

display details about the metadata types enabled for your org
Use this information to identify the syntax needed for a <name> element in package.xml. The most recent API version is
the default, or you can specify an older version.

The default target username is the admin user for the default scratch org. The username must have the Modify All Data
permission or the Modify Metadata permission (Beta). For more information about permissions, see Salesforce Help.

# examples

- $ <%= config.bin %> <%= command.id %> -a 43.0

- $ <%= config.bin %> <%= command.id %> -u me@example.com

- $ <%= config.bin %> <%= command.id %> -f /path/to/outputfilename.txt

- $ <%= config.bin %> <%= command.id %> -u me@example.com -f /path/to/outputfilename.txt

# flags.api-version

API version to use

# flags.output-file

path to the file where results are stored

# flags.filterknown

filter metadata known by the CLI

# flagsLong.apiversion

The API version to use. The default is the latest API version

# flagsLong.output-file

The path to the file where the results of the command are stored. Directing the output to a file makes it easier to
extract relevant information for your package.xml manifest file. The default output destination is the console.

# flagsLong.filterknown

Filters all the known metadata from the result such that all that is left are the types not yet fully supported by the
CLI.
