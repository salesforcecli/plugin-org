# summary

Create a default_agent_user for use with Agentforce and agentscript.

# description

Agent users are specialized user accounts designed to be used as default_agent_user in AgentScript. These users are
automatically configured with the Einstein Agent User profile and required Agentforce permission sets.

The command automatically:

- Checks that agent user licenses are available in your org
- Generates a globally unique username with a GUID for uniqueness
- Creates the user with the Einstein Agent User profile
- Assigns required permission sets: AgentforceServiceAgentBase, AgentforceServiceAgentUser,
  EinsteinGPTPromptTemplateUser
- Infers locale settings (timezone, language) from the current user

To assign additional permission sets after creation, use: sf org assign permset

The command performs comprehensive validation and provides clear error messages to help diagnose and resolve any issues
during the creation process.

# examples

- Create an agent user with auto-generated username:

  <%= config.bin %> <%= command.id %> --target-org myorg

- Create an agent user with a base username pattern (GUID will be appended):

  <%= config.bin %> <%= command.id %> --target-org myorg --base-username service-agent@corp.com

- Create an agent user with custom name:

  <%= config.bin %> <%= command.id %> --target-org myorg --first-name Service --last-name Agent

# flags.target-org.summary

Username or alias of the target org where the agent user will be created.

# flags.base-username.summary

Base username pattern. A GUID will be appended to ensure global uniqueness.

# flags.base-username.description

Specify a base username in email format (e.g., service-agent@corp.com). The command will append a 12-character GUID to
ensure the username is globally unique across all Salesforce orgs and sandboxes.

Example: "service-agent@corp.com" becomes "service-agent.a1b2c3d4e5f6@corp.com"

If not specified, the command auto-generates: agent.user.<GUID>@your-org-domain.com

# flags.first-name.summary

First name for the agent user.

# flags.last-name.summary

Last name for the agent user.
