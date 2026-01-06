# summary

Open an authoring bundle in your org's Agent Authoring Builder UI in a browser.

# description

Use the --api-name flag to open an authoring bundle using its API name in the Agent Authoring Builder UI of your org. To find the authoring bundle's API name, go to Setup in your org and navigate to the authoring bundle's details page.

To generate the URL but not launch it in your browser, specify --url-only.

To open Agent Authoring Builder in a specific browser, use the --browser flag. Supported browsers are "chrome", "edge", and "firefox". If you don't specify --browser, the org opens in your default browser.

# examples

- Open the authoring bundle with API name MyAuthoringBundle in your default org using your default browser:

  $ <%= config.bin %> <%= command.id %> --api-name MyAuthoringBundle

- Open the authoring bundle in an incognito window of your default browser:

  $ <%= config.bin %> <%= command.id %> --private --api-name MyAuthoringBundle

- Open the authoring bundle in an org with alias MyTestOrg1 using the Firefox browser:

  $ <%= config.bin %> <%= command.id %> --target-org MyTestOrg1 --browser firefox --api-name MyAuthoringBundle

# flags.api-name.summary

API name, also known as developer name, of the authoring bundle you want to open in the org's Agent Authoring Builder UI.

# flags.private.summary

Open the org in the default browser using private (incognito) mode.

# flags.browser.summary

Browser where the org opens.

# flags.url-only.summary

Display navigation URL, but don't launch browser.
