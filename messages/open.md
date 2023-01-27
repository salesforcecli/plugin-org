# summary

Open your default scratch org, or another specified org, in a browser.

# description

To open a specific page, specify the portion of the URL after "https://MyDomainName.my.salesforce.com/" as the value for the --path flag. For example, specify "--path lightning" to open Lightning Experience, or specify "--path /apex/YourPage" to open a Visualforce page.

To generate a URL but not launch it in your browser, specify --url-only.

To open in a specific browser, use the --browser flag. Supported browsers are "chrome", "edge", and "firefox". If you don't specify --browser, the org opens in your default browser.

# examples

- Open your default org in your default browser:

  $ <%= config.bin %> <%= command.id %>

- Open the org with alias MyTestOrg1 in the Firefox browser:

  $ <%= config.bin %> <%= command.id %> --target-org MyTestOrg1 --browser firefox

- Display the navigation URL for the Lightning Experience page for your default org, but don't open the page in a browser:

  $ <%= config.bin %> <%= command.id %> --url-only --path lightning

# flags.browser.summary

Browser where the org opens.

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

# domainTimeoutAction

The Lightning Experience-enabled custom domain may take a few more minutes to resolve. Try the "org:open" command again.
