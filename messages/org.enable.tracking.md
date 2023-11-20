# summary

Enable source tracking in local auth file.

# description

This has no effect on the org. It stores the setting in the CLI's configuration file for this org so that source tracking operations are executed when working with this org.

This command will throw an error if the org does not support tracking.

# examples

Enable tracking on an org using an alias

- <%= config.bin %> <%= command.id %> -o someAlias

Enable tracking on an org using a username

- <%= config.bin %> <%= command.id %> -o you@example.com

Enable tracking on your default org

- <%= config.bin %> <%= command.id %>

# success

Enabled source tracking for %s.

# error.TrackingNotAvailable

This org cannot enable source tracking because the SourceMember object is not available, or you do not have access to it.

# error.TrackingNotAvailable.actions

- If the org is a sandbox, make sure that your production org has Source Tracking enabled in sandboxes. See https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_setup_enable_source_tracking_sandboxes.htm.

- Make sure that your user can access the SourceMembers table via the tooling API.

- If the Org is a production org, source tracking cannot be enabled.
