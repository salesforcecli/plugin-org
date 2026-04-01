# summary

Open your org in Agentforce Studio, specifically in the list view showing the list of agents, or open a specific agent in Agentforce Builder.

# description

The list view shows the agents in your org that are implemented with Agent Script and an authoring bundle. Click on an agent name to open it in Agentforce Builder in a new browser window.

To open a specific agent directly in Agentforce Builder, provide the --api-name flag. Optionally include --version to open a specific version of the agent.

To generate the URL but not launch it in your browser, specify --url-only.

# examples

- Open the agents list view in your default org using your default browser:

  $ <%= config.bin %> <%= command.id %>

- Open a specific agent directly in Agentforce Builder:

  $ <%= config.bin %> <%= command.id %> --api-name MyAgent

- Open a specific version of an agent in Agentforce Builder:

  $ <%= config.bin %> <%= command.id %> --api-name MyAgent --version 1

- Open the agents list view in an incognito window of your default browser:

  $ <%= config.bin %> <%= command.id %> --private

- Open the agents list view in an org with alias MyTestOrg1 using the Firefox browser:

  $ <%= config.bin %> <%= command.id %> --target-org MyTestOrg1 --browser firefox

- Open a specific agent in a different org and display the URL only:

  $ <%= config.bin %> <%= command.id %> --api-name MyAgent --version 2 --target-org MyTestOrg1 --url-only

# flags.api-name.summary

API name of the agent to open in Agentforce Builder.

# flags.api-name.description

The API name of the agent to open directly in Agentforce Builder. Optionally specify --version to open a specific version.

# flags.version.summary

Version number of the agent to open in Agentforce Builder.

# flags.version.description

The version number of the agent to open directly in Agentforce Builder. Can only be used with the --api-name flag.

# flags.private.summary

Open the org in the default browser using private (incognito) mode.

# flags.browser.summary

Browser where the org opens.

# flags.url-only.summary

Display navigation URL, but don't launch browser.
