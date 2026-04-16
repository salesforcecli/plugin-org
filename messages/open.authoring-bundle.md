# summary

Open your org in Agentforce Studio, specifically in the list view showing the list of agents.

# description

The list view shows the agents in your org that are implemented with Agent Script and an authoring bundle. Click on an agent name to open it in Agentforce Builder in a new browser window.

To generate the URL but not launch it in your browser, specify --url-only.

# examples

- Open the agents list view in your default org using your default browser:

  $ <%= config.bin %> <%= command.id %>

- Open the agents list view in an incognito window of your default browser:

  $ <%= config.bin %> <%= command.id %> --private

- Open the agents list view in an org with alias MyTestOrg1 using the Firefox browser:

  $ <%= config.bin %> <%= command.id %> --target-org MyTestOrg1 --browser firefox

# flags.private.summary

Open the org in the default browser using private (incognito) mode.

# flags.browser.summary

Browser where the org opens.

# flags.url-only.summary

Display navigation URL, but don't launch browser.
