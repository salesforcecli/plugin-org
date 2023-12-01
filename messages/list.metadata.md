# description

Use this command to identify individual components in your manifest file or if you want a high-level view of particular metadata types in your org. For example, you can use this command to return a list of names of all the CustomObject or Layout components in your org, then use this information in a retrieve command that returns a subset of these components.

The username that you use to connect to the org must have the Modify All Data or Modify Metadata Through Metadata API Functions permission.

# summary

List the metadata components and properties of a specified type.

# examples

- List the CustomObject components, and their properties, in the org with alias "my-dev-org":

  $ <%= config.bin %> <%= command.id %> --metadata-type CustomObject --target-org my-dev-org

- List the CustomObject components in your default org, write the output to the specified file, and use API version 57.0:

  $ <%= config.bin %> <%= command.id %> --metadata-type CustomObject --api-version 57.0 --output-file /path/to/outputfilename.txt

- List the Dashboard components in your default org that are contained in the "folderSales" folder, write the output to the specified file, and use API version 57.0:

  $ <%= config.bin %> <%= command.id %> --metadata-type Dashboard --folder folderSales --api-version 57.0 --output-file /path/to/outputfilename.txt

# flags.api-version.summary

API version to use; default is the most recent API version.

# flags.output-file.summary

Pathname of the file in which to write the results.

# flags.metadata-type.summary

Metadata type to be retrieved, such as CustomObject; metadata type names are case-sensitive.

# flags.folder.summary

Folder associated with the component; required for components that use folders; folder names are case-sensitive.

# flags.folder.description

Examples of metadata types that use folders are Dashboard, Document, EmailTemplate, and Report.

# noMatchingMetadata

No metadata found for type: %s in org: %s.
