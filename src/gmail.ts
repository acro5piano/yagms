#!/usr/bin/env node

import { authenticate } from '@google-cloud/local-auth'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import fs from 'fs'
import { google } from 'googleapis'
import path from 'path'
import os from 'os'

const gmail = google.gmail('v1')

const server = new McpServer({
  name: 'gmail',
  version: '1.0.0',
  capabilities: {
    resources: {},
    tools: {},
  },
})

// Helper function to decode base64 encoded email content
function decodeBase64(data: string) {
  return Buffer.from(
    data.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  ).toString('utf8')
}

// Helper function to extract email parts
function parseEmailParts(parts: any[]): { text: string; html: string } {
  let text = ''
  let html = ''

  for (const part of parts || []) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += decodeBase64(part.body.data)
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += decodeBase64(part.body.data)
    } else if (part.parts) {
      const nestedParts = parseEmailParts(part.parts)
      text += nestedParts.text
      html += nestedParts.html
    }
  }

  return { text, html }
}

// Helper function to parse email headers
function getHeaderValue(headers: any[], name: string): string {
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  )
  return header ? header.value : ''
}

// Helper function to format an email for display
function formatEmail(message: any): any {
  const payload = message.payload || {}
  const headers = payload.headers || []

  const from = getHeaderValue(headers, 'From')
  const to = getHeaderValue(headers, 'To')
  const subject = getHeaderValue(headers, 'Subject')
  const date = getHeaderValue(headers, 'Date')

  let content = ''
  if (payload.body?.data) {
    content = decodeBase64(payload.body.data)
  } else if (payload.parts) {
    const { text, html } = parseEmailParts(payload.parts)
    content = text || html
  }

  return {
    id: message.id,
    threadId: message.threadId,
    from,
    to,
    subject,
    date,
    content,
    snippet: message.snippet,
  }
}

// Register Gmail tools
server.tool(
  'list-emails',
  'Get emails in inbox',
  {
    senderEmail: z
      .string()
      .email()
      .optional()
      .describe(
        'Filter by sender email. Use this to get previous email threads and opponent information.',
      ),
    maxResults: z
      .number()
      .min(1)
      .max(100)
      .default(10)
      .describe('Maximum number of emails to return'),
    labelIds: z
      .array(z.string())
      .default(['INBOX'])
      .describe('Label IDs to filter by (e.g., INBOX, UNREAD, SENT)'),
  },
  async ({ senderEmail, maxResults, labelIds }) => {
    try {
      let query = ''
      if (senderEmail) {
        query = `from:${senderEmail}`
      }

      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        labelIds,
        q: query,
      })

      const messages = response.data.messages || []
      if (messages.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No emails found matching the criteria.',
            },
          ],
        }
      }

      // Fetch full details for each message
      const emailDetails = await Promise.all(
        messages.map(async (message) => {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
          })
          return formatEmail(fullMessage.data)
        }),
      )

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(emailDetails, null, 2),
          },
        ],
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching emails: ${error.message}`,
          },
        ],
        isError: true,
      }
    }
  },
)

server.tool(
  'get-email',
  'Get a specific email by ID',
  {
    emailId: z.string().describe('The ID of the email to retrieve'),
  },
  async ({ emailId }) => {
    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: emailId,
      })

      const email = formatEmail(response.data)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(email, null, 2),
          },
        ],
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching email: ${error.message}`,
          },
        ],
        isError: true,
      }
    }
  },
)

// server.tool(
//   'send-email',
//   'Send an email',
//   {
//     to: z.string().email().describe('Recipient email address'),
//     subject: z.string().describe('Email subject'),
//     body: z.string().describe('Email body content (plain text)'),
//     cc: z.string().email().optional().describe('CC recipient email address'),
//     bcc: z.string().email().optional().describe('BCC recipient email address'),
//   },
//   async ({ to, subject, body, cc, bcc }) => {
//     try {
//       // Construct email content
//       const emailLines = []
//       emailLines.push(`To: ${to}`)
//       if (cc) emailLines.push(`Cc: ${cc}`)
//       if (bcc) emailLines.push(`Bcc: ${bcc}`)
//       emailLines.push(`Subject: ${subject}`)
//       emailLines.push('Content-Type: text/plain; charset=utf-8')
//       emailLines.push('')
//       emailLines.push(body)
//
//       const email = emailLines.join('\r\n')
//       const encodedEmail = Buffer.from(email)
//         .toString('base64')
//         .replace(/\+/g, '-')
//         .replace(/\//g, '_')
//         .replace(/=+$/, '')
//
//       const response = await gmail.users.messages.send({
//         userId: 'me',
//         requestBody: {
//           raw: encodedEmail,
//         },
//       })
//
//       return {
//         content: [
//           {
//             type: 'text',
//             text: `Email sent successfully. Message ID: ${response.data.id}`,
//           },
//         ],
//       }
//     } catch (error: any) {
//       return {
//         content: [
//           {
//             type: 'text',
//             text: `Error sending email: ${error.message}`,
//           },
//         ],
//         isError: true,
//       }
//     }
//   },
// )

server.tool(
  'search-emails',
  'Search for emails using Gmail search syntax',
  {
    query: z
      .string()
      .describe(
        'Gmail search query (e.g., "from:example@gmail.com has:attachment")',
      ),
    maxResults: z
      .number()
      .min(1)
      .max(100)
      .default(10)
      .describe('Maximum number of emails to return'),
  },
  async ({ query, maxResults }) => {
    try {
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query,
      })

      const messages = response.data.messages || []
      if (messages.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No emails found matching the search query.',
            },
          ],
        }
      }

      // Fetch full details for each message
      const emailDetails = await Promise.all(
        messages.map(async (message) => {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
          })
          return formatEmail(fullMessage.data)
        }),
      )

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(emailDetails, null, 2),
          },
        ],
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error searching emails: ${error.message}`,
          },
        ],
        isError: true,
      }
    }
  },
)

server.tool('get-labels', 'Get all Gmail labels', {}, async () => {
  try {
    const response = await gmail.users.labels.list({
      userId: 'me',
    })

    const labels = response.data.labels || []

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(labels, null, 2),
        },
      ],
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error fetching labels: ${error.message}`,
        },
      ],
      isError: true,
    }
  }
})

const credentialsPath =
  process.env.GMAIL_CREDENTIALS_PATH ||
  path.join(os.homedir(), '.yagms-credentials.json')

async function authenticateAndSaveCredentials() {
  console.log('Launching auth flow…')
  const auth = await authenticate({
    keyfilePath:
      process.env.GMAIL_OAUTH_PATH ||
      path.join(os.homedir(), '.yagms-oauth.keys.json'),
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.labels',
      // 'https://www.googleapis.com/auth/gmail.send',
    ],
  })
  fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials))
  console.log('Credentials saved. You can now run the server.')
}

async function loadCredentialsAndRunServer() {
  if (!fs.existsSync(credentialsPath)) {
    console.error(
      "Credentials not found. Please run with 'auth' argument first.",
    )
    process.exit(1)
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'))
  const auth = new google.auth.OAuth2()
  auth.setCredentials(credentials)
  google.options({ auth })

  console.error('Credentials loaded. Starting server.')
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Gmail MCP Server running on stdio')
}

if (process.argv[2] === 'auth') {
  authenticateAndSaveCredentials().catch(console.error)
} else {
  loadCredentialsAndRunServer().catch(console.error)
}
