# summary

Show the stored password for an org's user.

# description

Passwords are only available for orgs where a password was previously generated, such as by running "sf org generate password" or "sf org create user". Because passwords are sensitive credentials, this command prompts for confirmation before revealing it. Skip confirmation by specifying either the --no-prompt or --json flag.

# flags.no-prompt.summary

Skip the security warning and reveal the password without confirmation.

# prompt.show-user-password

You're about to reveal the password for "%s". Do you want to continue?

# warning.show-user-password

This command exposes a user password. While a password alone is not sufficient to gain access to an org (additional factors like a security token or an enabled OAuth username-password flow are required), treat it as a sensitive credential and avoid sharing or logging it.

# error.noPassword

No password found for "%s". A password is only available if one was previously generated, such as by running "sf org generate password" or "sf org create user".

# examples

- Show the password for the default org's user:

  <%= config.bin %> <%= command.id %>

- Show the password for an org with alias "my-org":

  <%= config.bin %> <%= command.id %> --target-org my-org

- Show the password without the confirmation prompt:

  <%= config.bin %> <%= command.id %> --target-org my-org --no-prompt

- Get the password as JSON for use in scripts:

  <%= config.bin %> <%= command.id %> --target-org my-org --json
