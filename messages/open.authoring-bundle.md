# summary

Open an org directly to the agents list view

# description

To generate the URL but not launch it in your browser, specify --url-only.

# examples

- Open to the agents list view in your default org using your default browser:

  $ <%= config.bin %> <%= command.id %>

- Open to the agents list view in an incognito window of your default browser:

  $ <%= config.bin %> <%= command.id %> --private

- Open to the agents list view in an org with alias MyTestOrg1 using the Firefox browser:

  $ <%= config.bin %> <%= command.id %> --target-org MyTestOrg1 --browser firefox

# flags.private.summary

Open the org in the default browser using private (incognito) mode.

# flags.browser.summary

Browser where the org opens.

# flags.url-only.summary

Display navigation URL, but don't launch browser.
