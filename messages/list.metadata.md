# description

This command is useful when you want to identify individual components in your manifest file or if you want a high-level
view of particular components in your organization. For example, you could use this target to return a list of names of
all Layout components in your org, then use this information in a retrieve operation that returns a subset of these
components.

# summary

display properties of metadata components of a specified type

# examples

- $ <%= config.bin %> <%= command.id %> -m CustomObject

- $ <%= config.bin %> <%= command.id %> -m CustomObject -a 43.0

- $ <%= config.bin %> <%= command.id %> -m CustomObject -o me@example.com

- $ <%= config.bin %> <%= command.id %> -m CustomObject -f /path/to/outputfilename.txt

- $ <%= config.bin %> <%= command.id %> -m Dashboard --folder foldername

- $ <%= config.bin %> <%= command.id %> -m Dashboard --folder foldername -a 43.0

- $ <%= config.bin %> <%= command.id %> -m Dashboard --folder foldername -o me@example.com

- $ <%= config.bin %> <%= command.id %> -m Dashboard --folder foldername -f /path/to/outputfilename.txt

- $ <%= config.bin %> <%= command.id %> -m CustomObject -o me@example.com -f /path/to/outputfilename.txt

# flags.api-version

API version to use

# flags.output-file

path to the file where results are stored

# flags.metadatatype

metadata type to be retrieved, such as CustomObject; metadata type value is case-sensitive

# flags.folder

folder associated with the component; required for components that use folders; folder names are case-sensitive

# flagsLong.apiversion

The API version to use. The default is the latest API version

# flagsLong.output-file

The path to the file where the results of the command are stored. The default output destination is the console.

# flagsLong.metadatatype

The metadata type to be retrieved, such as CustomObject or Report. The metadata type value is case-sensitive.

# flagsLong.folder

The folder associated with the component. This parameter is required for components that use folders, such as Dashboard,
Document, EmailTemplate, or Report. The folder name value is case-sensitive.

# noMatchingMetadata

No metadata found for type: %s in org: %s
