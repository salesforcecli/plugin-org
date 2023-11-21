# summary

Prevent Salesforce CLI from tracking changes in your source files between your project and an org.

# description

Disabling source tracking has no direct effect on the org, it affects only your local environment. Specifically, Salesforce CLI stores the setting in the org's local configuration file so that no source tracking operations are executed when working with the org.

# examples

- Disable source tracking for an org with alias "myscratch":

  <%= config.bin %> <%= command.id %> --target-org myscratch

- Disable source tracking for an org using a username:

  <%= config.bin %> <%= command.id %> --target-org you@example.com

- Disable source tracking for your default org:

  <%= config.bin %> <%= command.id %>

# success

Disabled source tracking for %s.
