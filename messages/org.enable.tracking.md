# summary

Allow Salesforce CLI to track changes in your source files between your project and an org.

# description

Enabling source tracking has no direct effect on the org, it affects only your local environment. Specifically, Salesforce CLI stores the setting in the org's local configuration file so that source tracking operations are executed when working with the org.

This command throws an error if the org doesn't support tracking. Examples of orgs that don't support source tracking include Developer Edition orgs, production orgs, Partial Copy sandboxes, and Full sandboxes.

# examples

- Enable source tracking for an org with alias "myscratch":

  <%= config.bin %> <%= command.id %> --target-org myscratch

- Enable source tracking for an org using a username:

  <%= config.bin %> <%= command.id %> --target-org you@example.com

- Enable source tracking for your default org:

  <%= config.bin %> <%= command.id %>

# success

Enabled source tracking for %s.

# error.TrackingNotAvailable

You can't enable source tracking on this org because the SourceMember Tooling API object isn't available, or you don't have access to it.

# error.TrackingNotAvailable.actions

- If the org is a Developer or Developer Pro sandbox, make sure that the associated production org has enabled source tracking in sandboxes. See https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_setup_enable_source_tracking_sandboxes.htm.

- Make sure that your user can access the SourceMember Tooling API object.

- You can't enable source tracking on Developer Edition orgs, production orgs, Partial Copy sandboxes, or Full sandboxes.
