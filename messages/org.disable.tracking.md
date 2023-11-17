# summary

Disable source tracking in local auth file.

# description

This has no effect on the org. It stores the setting in the CLI's configuration file for this org so that no source tracking operations are executed when working with this org.

# examples

Disable tracking on an org using an alias

- <%= config.bin %> <%= command.id %> -o someAlias

Disable tracking on an org using a username

- <%= config.bin %> <%= command.id %> -o you@example.com

Disable tracking on your default org

- <%= config.bin %> <%= command.id %>

# success

Disabled source tracking for %s.
