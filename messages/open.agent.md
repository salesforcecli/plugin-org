# summary

Open an agent in the Agent Builder org UI in a browser.

# description

Use the --name flag to open an agent using the developer name (aka API name) in the Agent Builder Org UI.

To generate a URL but not launch it in your browser, specify --url-only.

To open in a specific browser, use the --browser flag. Supported browsers are "chrome", "edge", and "firefox". If you don't specify --browser, the org opens in your default browser.

# examples

- Open the agent with developer name "Coral_Cloud_Agent using the default browser:

  $ <%= config.bin %> <%= command.id %> --name Coral_Cloud_Agent

- Open the agent in an incognito window of your default browser:

  $ <%= config.bin %> <%= command.id %> --private --name Coral_Cloud_Agent

- Open the agent in the org with alias MyTestOrg1 using the Firefox browser:

  $ <%= config.bin %> <%= command.id %> --target-org MyTestOrg1 --browser firefox --name Coral_Cloud_Agent

# flags.name.summary

The developer name (aka API name) of the agent to open in the Agent Builder org UI.

# flags.private.summary

Open the org in the default browser using private (incognito) mode.

# flags.browser.summary

Browser where the org opens.

# flags.url-only.summary

Display navigation URL, but don’t launch browser.
