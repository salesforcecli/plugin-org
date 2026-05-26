# summary

Open an agent in your org's Agentforce Builder UI in a browser.

# description

Use the --api-name flag to open an agent using its API name in the Agentforce Builder UI of your org. Alternatively, use the --authoring-bundle flag to open an agent using the API name of its authoring bundle. The two API names are typically the same for the same agent. Optionally specify the --version flag to open a specific version of the agent.

To generate the URL but not launch it in your browser, specify --url-only.

To open Agentforce Builder in a specific browser, use the --browser flag. Supported browsers are "chrome", "edge", and "firefox". If you don't specify --browser, the org opens in your default browser.

# examples

- Open the agent with API name Coral_Cloud_Agent in your default org using your default browser; opens the highest version:

  $ <%= config.bin %> <%= command.id %> --api-name Coral_Cloud_Agent

- Open the agent in an incognito window of your default browser:

  $ <%= config.bin %> <%= command.id %> --private --api-name Coral_Cloud_Agent:

- Open the agent in an org with alias MyTestOrg1 using the Firefox browser:

  $ <%= config.bin %> <%= command.id %> --target-org MyTestOrg1 --browser firefox --api-name Coral_Cloud_Agent

- Open an agent in Agentforce Builder using its authoring bundle API name:

  $ <%= config.bin %> <%= command.id %> --authoring-bundle Coral_Cloud_Agent

- Open a version 1 of an agent in Agentforce Builder:

  $ <%= config.bin %> <%= command.id %> --authoring-bundle Coral_Cloud_Agent --version 1

# flags.api-name.summary

API name, also known as developer name, of the agent you want to open in the org's Agentforce Builder UI.

# flags.private.summary

Open the agent in the default browser using private (incognito) mode.

# flags.browser.summary

Browser where the org opens.

# flags.url-only.summary

Display navigation URL, but don’t launch browser.

# flags.authoring-bundle.summary

API name of the agent's authoring bundle to open in Agentforce Builder.

# flags.version.summary

Version number of the agent to open in Agentforce Builder. If not specified, the highest version is opened by default.
