# description

open your default scratch org, or another specified org
To open a specific page, specify the portion of the URL after "https://MyDomainName.my.salesforce.com/" as --path.
For example, specify "--path lightning" to open Lightning Experience, or specify "--path /apex/YourPage" to open a Visualforce page.
To generate a URL but not launch it in your browser, specify --urlonly.
To open in a specific browser, use the --browser parameter. Supported browsers are "chrome", "edge", and "firefox". If you don't specify --browser, the org opens in your default browser.

# examples

- $ <%= config.bin %> <%= command.id %>

- $ <%= config.bin %> <%= command.id %> -u me@my.org

- $ <%= config.bin %> <%= command.id %> -u MyTestOrg1

- $ <%= config.bin %> <%= command.id %> -r -p lightning

- $ <%= config.bin %> <%= command.id %> -u me@my.org -b firefox

# browser

browser where the org opens

# cliPath

navigation URL path

# urlonly

display navigation URL, but don’t launch browser

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
