# summary

Display information about an org.

# description

Output includes your access token, client Id, connected status, org ID, instance URL, username, and alias, if applicable.

Use --verbose to include the SFDX auth URL. WARNING: The SFDX auth URL contains sensitive information, such as a refresh token that can be used to access an org. Don't share or distribute this URL or token.

Including --verbose displays the sfdxAuthUrl property only if you authenticated to the org using "org login web" (not "org login jwt").

# flags.verbose.summary

Display the sfdxAuthUrl property.

# examples

- Display information about your default org:

  $ <%= config.bin %> <%= command.id %>

- Display information, including the sfdxAuthUrl property, about the org with alias TestOrg1:

  $ <%= config.bin %> <%= command.id %> --target-org TestOrg1 --verbose

# noScratchOrgInfoError

No information for scratch org with ID %s found in Dev Hub %s.

# noScratchOrgInfoAction

First check that you can access your Dev Hub. Then check that the ScratchOrgInfo standard object in your Dev Hub contains a record for your scratch org. In Setup, navigate to the Dev Hub page and click the Scratch Org Infos tab. If you find your scratch org, try again.
