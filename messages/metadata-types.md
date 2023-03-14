# description

The information includes Apex classes and triggers, custom objects, custom fields on standard objects, tab sets that define an app, and many other metadata types. Use this information to identify the syntax needed for a <name> element in a manifest file (package.xml).

The username that you use to connect to the org must have the Modify All Data or Modify Metadata Through Metadata API Functions permission.

# summary

Display details about the metadata types that are enabled for your org.

# examples

- Display information about all known and enabled metadata types in the org with alias "my-dev-org" using API version 57.0:

  $ <%= config.bin %> <%= command.id %> --api-version 57.0 --target-org my-dev-org

- Display only the metadata types that aren't yet supported by Salesforce CLI in your default org and write the results to the specified file:

  $ <%= config.bin %> <%= command.id %> --output-file /path/to/outputfilename.txt --filter-known

# flags.api-version.summary

API version to use; default is the most recent API version.

# flags.output-file.summary

Pathname of the file in which to write the results.

# flags.filter-known.summary

Filter the known metadata types from the result to display only the types not yet fully supported by Salesforce CLI.

filter metadata known by the CLI

# flags.output-file.description

Directing the output to a file makes it easier to extract relevant information for your package.xml manifest file. The default output destination is the terminal or command window console.
