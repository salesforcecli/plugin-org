# SecurityWarning

This command will expose sensitive information that allows for subsequent activity using your current authenticated session.
Sharing this information is equivalent to logging someone in under the current credential, resulting in unintended access and escalation of privilege.
For additional information, please review the authorization section of the https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm.

# BehaviorChangeWarning

Starting in August 2025, this command will generate single-use URLs when you specify either the --json or --url-only (-r) flag. These URLs can be used only one time; subsequent use won't allow you to log in to the org.

# SingleAccessFrontdoorError

Failed to generate a single-use frontdoor URL.
