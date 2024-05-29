# summary

Resume the creation of an incomplete scratch org.

# description

When the original "<%= config.bin %> org create scratch" command either times out or is run with the --async flag, it displays a job ID.

Run this command by either passing it a job ID or using the --use-most-recent flag to specify the most recent incomplete scratch org.

# examples

- Resume a scratch org create with a job ID:

  <%= config.bin %> <%= command.id %> --job-id 2SR3u0000008fBDGAY

- Resume your most recent incomplete scratch org:

  <%= config.bin %> <%= command.id %> --use-most-recent

# flags.job-id.summary

Job ID of the incomplete scratch org create that you want to resume.

# flags.job-id.description

The job ID is the same as the record ID of the incomplete scratch org in the ScratchOrgInfo object of the Dev Hub.

The job ID is valid for 24 hours after you start the scratch org creation.

# flags.use-most-recent.summary

Use the job ID of the most recent incomplete scratch org.

# error.NoRecentJobId

There are no recent job IDs (ScratchOrgInfo requests) in your cache. Maybe it completed or already resumed?

# error.jobIdMismatch

There are no recent job IDs (ScratchOrgInfo requests) in your cache that match %s. Maybe it completed?

# success

Your scratch org is ready.
