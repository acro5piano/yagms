# yagms

Yet Another Gmail MCP Server

## Setup and Usage

### Gmail MCP Server

The Gmail MCP server provides tools to interact with your Gmail account through the Model Context Protocol (MCP).

#### Prerequisites

1. Create OAuth credentials for Gmail API:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Gmail API
   - Create OAuth 2.0 credentials (Desktop application)
   - Download the credentials JSON file and save it as `~/.yagms-oauth.keys.json`

### Build this project

1. Install Bun.
2. Build the code

```bash
bun install
bun run build-gmail # It will emit ./dist/gmail.js
```

#### Authentication

Before using the Gmail MCP server, you need to authenticate with your Google account:

```bash
# Run the authentication flow
bun run dist/gmail.js auth
```

This will:

- Launch a browser window for you to sign in to your Google account
- Request permission to access your Gmail account
- Save the authentication credentials to `~/.yagms-credentials.json`

#### Running the Server

After authentication, you can run the Gmail MCP server:

```bash
# Run the server
bun run src/gmail.ts
```

#### Configuration

You can customize the paths for OAuth keys and credentials using environment variables:

- `GMAIL_OAUTH_PATH`: Path to the OAuth keys file (default: `~/.yagms-oauth.keys.json`)
- `GMAIL_CREDENTIALS_PATH`: Path to save the credentials (default: `~/.yagms-credentials.json`)

#### Available Tools

The Gmail MCP server provides the following tools:

1. **list-emails**: Get emails from your inbox

   - Parameters:
     - `senderEmail` (optional): Filter by sender email
     - `maxResults` (optional, default: 10): Maximum number of emails to return
     - `labelIds` (optional, default: ["INBOX"]): Label IDs to filter by

2. **get-email**: Get a specific email by ID

   - Parameters:
     - `emailId`: The ID of the email to retrieve

3. **search-emails**: Search for emails using Gmail search syntax

   - Parameters:
     - `query`: Gmail search query (e.g., "from:example@gmail.com has:attachment")
     - `maxResults` (optional, default: 10): Maximum number of emails to return

4. **get-labels**: Get all Gmail labels
   - No parameters required

#### Example MCP Configuration

Add this to your MCP settings file:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "bun",
      "args": ["run", "/path/to/yagms/dist/gmail.js"],
      "env": {},
      "disabled": false,
      "autoApprove": []
    }
  }
}
```
