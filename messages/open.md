# summary

Open your default scratch org, or another specified org, in a browser.

# description

To open a specific page, specify the portion of the URL after "https://mydomain.my.salesforce.com" as the value for the --path flag. For example, specify "--path lightning" to open Lightning Experience, or specify "--path /apex/YourPage" to open a Visualforce page.

Use the --source-file to open a Lightning Page from your local project in Lightning App Builder. Lightning page files have the suffix .flexipage-meta.xml, and are stored in the "flexipages" directory.

To generate a URL but not launch it in your browser, specify --url-only.

To open in a specific browser, use the --browser flag. Supported browsers are "chrome", "edge", and "firefox". If you don't specify --browser, the org opens in your default browser.

# examples

- Open your default org in your default browser:

  $ <%= config.bin %> <%= command.id %>

- Open your default org in an incognito window of your default browser:

  $ <%= config.bin %> <%= command.id %> --private

- Open the org with alias MyTestOrg1 in the Firefox browser:

  $ <%= config.bin %> <%= command.id %> --target-org MyTestOrg1 --browser firefox

- Display the navigation URL for the Lightning Experience page for your default org, but don't open the page in a browser:

  $ <%= config.bin %> <%= command.id %> --url-only --path lightning

- Open a local Lightning page in your default org's Lightning App Builder:

  $ <%= config.bin %> <%= command.id %> --source-file force-app/main/default/flexipages/Hello.flexipage-meta.xml

- Open a local Flow in Flow Builder:

  $ <%= config.bin %> <%= command.id %> --source-file force-app/main/default/flows/Hello.flow-meta.xml

# flags.private.summary

Open the org in the default browser using private (incognito) mode.

# flags.browser.summary

Browser where the org opens.

# flags.source-file.summary

Path to an ApexPage or FlexiPage to open in Lightning App Builder.

# flags.path.summary

Navigation URL path to open a specific page.

# flags.url-only.summary

Display navigation URL, but don’t launch browser.

# containerAction

You are in a headless environment. To access the org %s, open this URL in a browser:

%s

# humanSuccess

Access org %s as user %s with the following URL: %s

# humanSuccessNoUrl

Opening org %s as user %s

# domainWaiting

Waiting to resolve the Lightning Experience-enabled custom domain...

# domainTimeoutError

The Lightning Experience-enabled custom domain is unavailable.

# FlowIdNotFound

No ID not found for Flow %s.

# FlowIdNotFound.actions

- Check that the Flow you want to open is deployed to the org.
- Run `sf org open -p lightning/setup/Flows/home` to open the list of Flows
