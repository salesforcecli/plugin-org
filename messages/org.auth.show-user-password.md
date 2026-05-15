# summary

Show the stored password for an org's user.

# description

This command shows only passwords that were generated locally in your DX project with either the "org generate password" or "org create user" CLI command. If you generated a password for a user in Setup in your org, you can't show it with this command.

Because passwords are sensitive credentials, this command prompts for confirmation before revealing it. Skip confirmation by specifying either the --no-prompt or --json flag.

# flags.no-prompt.summary

Skip the security warning and reveal the password without confirmation.

# prompt.show-user-password

You're about to reveal the password for "%s". Do you want to continue?

# warning.show-user-password

This command exposes a user password. While a password alone is not sufficient to gain access to an org (additional factors like a security token or an enabled OAuth username-password flow are required), treat it as a sensitive credential and avoid sharing or logging it.

# error.noPassword

No password found for "%s". A password is available only if one was previously generated locally in your DX project by running either "sf org generate password" or "sf org create user". If you generated a password in your org using Setup, it's not available to this command.

# examples

- Show the password for the default org's user:

  <%= config.bin %> <%= command.id %>

- Show the password for an org with alias "my-org":

  <%= config.bin %> <%= command.id %> --target-org my-org

- Show the password without the confirmation prompt:

  <%= config.bin %> <%= command.id %> --target-org my-org --no-prompt

- Get the password as JSON for use in scripts:

  <%= config.bin %> <%= command.id %> --target-org my-org --json
