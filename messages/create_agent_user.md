# summary

Create the default Salesforce user that is used to run an agent.

# description

You specify this user in the agent's Agent Script file using the "default_agent_user" parameter in the "config" block.

By default, this command:

- Generates a user called "Agent User" with a globally unique username. Use flags to change these default names.
- Sets the user's email to the new username.
- Assigns the user the "Einstein Agent User" profile.
- Assigns the user these required permission sets: AgentforceServiceAgentBase, AgentforceServiceAgentUser, EinsteinGPTPromptTemplateUser
- Checks that the user licenses required by the profile and permission sets are available in your org.

The generated user doesn't have a password. You can’t log into Salesforce using the agent user's username. Only Salesforce users with admin permissions can view or edit an agent user in Setup.

To assign additional permission sets or licenses after the user was created, use the "org assign permset" or "org assign permsetlicense" commands.

When the command completes, it displays a summary of what it did, including the new agent user's username and ID, the available licenses associated with the Einstein Agent User profile, and the profile and permission sets assigned to the agent user.

# examples

- Create an agent user with an auto-generated username; create the user in the org with alias "myorg":

  <%= config.bin %> <%= command.id %> --target-org myorg

- Create an agent user by specifying a base usernmane pattern; to make the username unique, the command appends a unique identifier:

  <%= config.bin %> <%= command.id %> --base-username service-agent@corp.com --target-org myorg

- Create an agent user with an auto-generated username but the custom name "Service Agent"; create the user in your default org:

  <%= config.bin %> <%= command.id %> --first-name Service --last-name Agent

# flags.target-org.summary

Username or alias of the target org where the agent user will be created.

# flags.base-username.summary

Base username pattern. A unique ID is appended to ensure global uniqueness of the usename.

# flags.base-username.description

Specify a base username in email format, such as "service-agent@corp.com". The command then appends a 12-character globally unique ID (GUID) to the name before the "@" sign, which ensures that the username is globally unique across all Salesforce orgs and sandboxes.

For example, if you specify "service-agent@corp.com", then the username might be "service-agent.a1b2c3d4e5f6@corp.com".

If not specified, the command auto-generates the username using this pattern: "agent.user.<GUID>@your-org-domain.com".

# flags.first-name.summary

First name for the agent user.

# flags.last-name.summary

Last name for the agent user.
