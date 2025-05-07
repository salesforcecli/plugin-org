# summary

Open an agent in your org's Agent Builder UI in a browser.

# description

Use the --api-name flag to open an agent using its API name in the Agent Builder UI of your org. To find the agent's API name, go to Setup in your org and navigate to the agent's details page.

To generate the URL but not launch it in your browser, specify --url-only.

To open Agent Builder in a specific browser, use the --browser flag. Supported browsers are "chrome", "edge", and "firefox". If you don't specify --browser, the org opens in your default browser.

# examples

- Open the agent with API name Coral_Cloud_Agent in your default org using your default browser:

  $ <%= config.bin %> <%= command.id %> --api-name Coral_Cloud_Agent

- Open the agent in an incognito window of your default browser:

  $ <%= config.bin %> <%= command.id %> --private --api-name Coral_Cloud_Agent:

- Open the agent in an org with alias MyTestOrg1 using the Firefox browser:

  $ <%= config.bin %> <%= command.id %> --target-org MyTestOrg1 --browser firefox --api-name Coral_Cloud_Agent

# flags.api-name.summary

API name, also known as developer name, of the agent you want to open in the org's Agent Builder UI.

# flags.private.summary

Open the org in the default browser using private (incognito) mode.

# flags.browser.summary

Browser where the org opens.

# flags.url-only.summary

Display navigation URL, but don’t launch browser.
