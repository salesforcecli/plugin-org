# summary

display information about an org

# description

get the description for the current or target org
Output includes your access token, client Id, connected status, org ID, instance URL, username, and alias, if applicable.
Use --verbose to include the SFDX auth URL. WARNING: The SFDX auth URL contains sensitive information, such as a refresh token that can be used to access an org. Don't share or distribute this URL or token.
Including --verbose displays the sfdxAuthUrl property only if you authenticated to the org using auth:web:login (not auth:jwt:grant)

# flags.verbose

display the sfdxAuthUrl property

# examples

- $ <%= config.bin %> <%= command.id %>

- $ <%= config.bin %> <%= command.id %> -u me@my.org

- $ <%= config.bin %> <%= command.id %> -u TestOrg1 --json

- $ <%= config.bin %> <%= command.id %> -u TestOrg1 --json > tmp/MyOrgDesc.json

# noScratchOrgInfoError

No information for scratch org with ID %s found in Dev Hub %s.

# noScratchOrgInfoAction

First check that you can access your Dev Hub. Then check that the ScratchOrgInfo standard object in your Dev Hub contains a record for your scratch org. In Setup, navigate to the Dev Hub page and click the Scratch Org Infos tab. If you find your scratch org, try again.
