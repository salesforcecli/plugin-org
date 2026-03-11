# Agent User Creation Command

## Overview

Created a **dramatically simplified** command `sf org create agent-user` that creates agent users for use as `default_agent_user` in AgentScript.

## Command Location

- **File**: `src/commands/org/create/agent-user.ts`
- **Command**: `sf org create agent-user`
- **Messages**: `messages/create_agent_user.md`

## Philosophy: Simplicity Over Configuration

This command follows the principle of **convention over configuration**. It makes smart defaults and inferences so users (both humans and AI agents) don't have to make unnecessary decisions.

## Flags (Only 5, all optional except target-org!)

```bash
sf org create agent-user
  --target-org <value>      # REQUIRED: where to create the user
  --username <value>        # OPTIONAL: specific username (mutually exclusive with base-username)
  --base-username <value>   # OPTIONAL: username pattern, GUID appended (mutually exclusive with username)
  --first-name <value>      # OPTIONAL: default "Agent"
  --last-name <value>       # OPTIONAL: default "User"
```

Everything else is automatic.

## What The Command Does Automatically

### 1. **Username Generation (3 strategies)**

- **Auto-generated**: Creates username like `agent.user.a1b2c3d4e5f6@your-org-domain.com`
- **Base pattern**: Use `--base-username service-agent@corp.com` → creates `service-agent.a1b2c3d4e5f6@corp.com`
- **Explicit**: Use `--username` to specify exact username (validated for global uniqueness)

### 2. **Profile Assignment**

- **Always uses**: `Einstein Agent User` profile (specifically designed for agent users)
- No configuration needed - this is the correct profile for agents

### 3. **Locale Settings (Inferred from Current User)**

- TimeZone
- Locale (language/region)
- Email Encoding
- Language

Falls back to sensible defaults (`America/Los_Angeles`, `en_US`, `UTF-8`) if inference fails.

### 4. **User Fields (Hardcoded)**

- FirstName: `"Agent"`
- LastName: `"User"`
- Alias: Auto-generated from username (first 8 chars)
- Email: Set to username

### 5. **Permission Sets (Always Assigned)**

These three permission sets are **required** for agent users:

- `AgentforceServiceAgentBase`
- `AgentforceServiceAgentUser`
- `EinsteinGPTPromptTemplateUser`

For additional permission sets, use: `sf org assign permset --on-behalf-of <username>`

### 6. **License Checking**

- Always checks for available Agent user licenses
- Provides clear error messages with actionable steps if licenses aren't available
- No flag to skip - it's fast and prevents errors

## Usage Examples

```bash
# Most common - auto-generates everything
sf org create agent-user --target-org myorg

# With specific username
sf org create agent-user --target-org myorg --username service.agent@company.com

# With base username pattern (GUID appended)
sf org create agent-user --target-org myorg --base-username service-agent@corp.com

# With custom name
sf org create agent-user --target-org myorg --first-name Service --last-name Agent

# Combination
sf org create agent-user --target-org myorg \
  --base-username service-agent@corp.com \
  --first-name Production \
  --last-name Agent

# Assign additional permission sets after creation
sf org create agent-user --target-org myorg
sf org assign permset --name CustomPermSet --target-org myorg --on-behalf-of <username>
```

## JSON Output

```json
{
  "status": 0,
  "result": {
    "userId": "005000000000001AAA",
    "username": "agent.user.a1b2c3d4e5f6@example.com",
    "profileId": "00e000000000001AAA",
    "permissionSetsAssigned": [
      "AgentforceServiceAgentBase",
      "AgentforceServiceAgentUser",
      "EinsteinGPTPromptTemplateUser"
    ],
    "permissionSetErrors": []
  }
}
```

## Why This Simplification?

### ✅ What We Kept (Optional with Smart Defaults)

| Flag              | Default        | Why?                                        |
| ----------------- | -------------- | ------------------------------------------- |
| `--username`      | Auto-generated | Full control when you need it               |
| `--base-username` | N/A            | Useful pattern for branded service accounts |
| `--first-name`    | "Agent"        | Customize if needed, sensible default       |
| `--last-name`     | "User"         | Customize if needed, sensible default       |

### ❌ What We Removed

| Flag                                                        | Why Removed                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `--profile-name`                                            | Agent users must use "Einstein Agent User" profile                            |
| `--alias`                                                   | Auto-generated from username works great                                      |
| `--permission-sets`                                         | Always assign the 3 required ones; use `sf org assign permset` for additional |
| `--time-zone`, `--locale`, `--language`, `--email-encoding` | Inferred from current user                                                    |
| `--skip-license-check`                                      | Always check - it's fast and prevents errors                                  |

### ✅ Benefits

**For AI Agents:**

- **2 flags instead of 13** - Dramatically fewer decisions to make
- **Predictable** - Same command works everywhere
- **Less error-prone** - Fewer flags = fewer mistakes
- **Clear errors** - Fast failure with actionable recovery steps

**For Humans:**

- **Dead simple** - `--target-org myorg` and you're done
- **No decision paralysis** - Smart defaults handle everything
- **Quick to learn** - 2 flags, not 13
- **Hard to misuse** - Can't accidentally create an incorrectly configured agent user

## Implementation Details

### Key Methods

1. **`generateUsername()`**: Auto-generates username with GUID or validates explicit username
2. **`checkAgentUserLicenses()`**: Validates available agent user licenses (always runs)
3. **`getProfileId()`**: Looks up "Einstein Agent User" profile
4. **`inferLocaleSettings()`**: Queries current user's locale settings with fallback to defaults
5. **`createAgentUser()`**: Creates user with hardcoded defaults and inferred settings
6. **`assignPermissionSets()`**: Assigns the 3 required permission sets

### Error Handling

Each error includes:

- **Error name**: Unique identifier (e.g., `NoAgentLicensesError`)
- **Error message**: Clear description
- **Actions**: Array of recovery steps

Perfect for AI agents to understand and recover from failures.

## Files

- `src/commands/org/create/agent-user.ts` - Command implementation
- `messages/create_agent_user.md` - Documentation and messages

## Design Decisions

### Why "Einstein Agent User" profile?

This is the Salesforce-standard profile specifically designed for agent users. Using anything else would be incorrect.

### Why infer locale from current user?

The current user's locale is likely correct for the org. If not, it's close enough for a service account.

### Why not allow custom permission sets?

The 3 required permission sets are non-negotiable. Additional sets should be assigned separately using `sf org assign permset` which is more explicit and auditable.

### Why always check licenses?

The check is fast (~1 second) and prevents a more cryptic error during user creation. Better to fail fast with a clear message.

## Comparison: Before vs After

### Before (13 flags, complex)

```bash
sf org create agent-user \
  --target-org myorg \
  --base-username service-agent@corp.com \
  --first-name Service \
  --last-name Agent \
  --alias svcagent \
  --profile-name "System Administrator" \
  --permission-sets AgentforceServiceAgentBase \
  --permission-sets AgentforceServiceAgentUser \
  --permission-sets EinsteinGPTPromptTemplateUser \
  --time-zone America/New_York \
  --locale en_US \
  --language en_US
```

### After (5 flags, simple with smart defaults)

```bash
# Most common - uses all defaults
sf org create agent-user --target-org myorg

# With customization when needed
sf org create agent-user --target-org myorg \
  --base-username service-agent@corp.com \
  --first-name Service \
  --last-name Agent
```

**Result**:

- 13 flags → 5 flags (60% reduction)
- All non-essential flags removed or inferred
- Most common case requires only `--target-org`
- Customization available when needed

## Future Enhancements

Potential improvements:

1. Community nickname generation (org-unique)
2. Dry run mode (`--dry-run`) to validate without creating
3. Better output showing the created user's org URL
4. Bulk user creation from a list

Keep it simple! Only add features when there's a clear need.
