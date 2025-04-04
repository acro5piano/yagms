import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer(
  {
    name: 'yagms',
    version: '0.0.1',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
)

// Register weather tools
server.tool(
  'list-emails',
  'Get emails in inbox',
  {
    senderEmail: z
      .string()
      .email()
      .describe(
        'Filter by sender email. Use this to get previous email threads and opponent information.',
      ),
  },
  async ({ senderEmail }) => {
    // TODO
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Weather MCP Server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error in main():', error)
  process.exit(1)
})
