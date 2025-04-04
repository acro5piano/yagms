import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new Server(
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
