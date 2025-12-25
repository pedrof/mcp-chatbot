/**
 * Test script to directly call a Garmin MCP tool
 * Usage: npx tsx test-mcp-tool.ts [url]
 *
 * Examples:
 *   npx tsx test-mcp-tool.ts
 *   npx tsx test-mcp-tool.ts http://localhost:8080/mcp
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

async function tryConnect(url: string): Promise<Client | null> {
  const transport = new StreamableHTTPClientTransport(new URL(url))
  const client = new Client(
    {
      name: 'mcp-test-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  )

  try {
    await client.connect(transport)
    return client
  } catch (error) {
    return null
  }
}

async function testGarminTool() {
  console.log('🔧 Testing Garmin MCP Server Tool...\n')

  // Try multiple URLs
  const urls = [
    process.argv[2] || 'http://host.containers.internal:8080/mcp',
    'http://localhost:8080/mcp',
    'http://127.0.0.1:8080/mcp'
  ]

  let client: Client | null = null
  let connectedUrl = ''

  for (const url of urls) {
    console.log(`🔍 Trying to connect to: ${url}`)
    client = await tryConnect(url)
    if (client) {
      connectedUrl = url
      console.log(`✅ Connected to: ${url}\n`)
      break
    } else {
      console.log(`❌ Failed to connect to: ${url}`)
    }
  }

  if (!client) {
    console.error('\n❌ Could not connect to any MCP server URL')
    console.error('\nTried:')
    urls.forEach(url => console.error(`  - ${url}`))
    console.error('\nPlease ensure:')
    console.error('1. The Garmin MCP server is running')
    console.error('2. It\'s listening on port 8080')
    console.error('3. The network connection is working\n')
    process.exit(1)
  }

  try {
    // List available tools
    console.log('📋 Listing available tools...')
    const toolsResult = await client.listTools()
    console.log(`Found ${toolsResult.tools.length} tools:`)
    toolsResult.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description || 'No description'}`)
    })
    console.log('')

    // Test dates
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const testDates = [today, yesterday, '2024-12-20']

    for (const testDate of testDates) {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`🧪 Testing get_steps_data with date: ${testDate}`)
      console.log(`${'='.repeat(80)}`)
      console.log('Arguments:', JSON.stringify({ date: testDate }, null, 2))
      console.log('')

      try {
        const result = await client.callTool({
          name: 'get_steps_data',
          arguments: { date: testDate }
        })

        console.log('✅ Tool call succeeded!')
        console.log('Full result:', JSON.stringify(result, null, 2))
        console.log('')

        if (result.content && result.content.length > 0) {
          console.log('📊 Content received:')
          result.content.forEach((item, index) => {
            console.log(`  [${index}] Type: ${item.type}`)
            if (item.type === 'text' && 'text' in item) {
              console.log(`      Text: ${item.text}`)
            }
            if ('data' in item && item.data) {
              console.log(`      Data: ${JSON.stringify(item.data, null, 2)}`)
            }
          })
          console.log('')
        } else {
          console.log('⚠️  No content returned (empty array)!')
          console.log('❌ BUG: The MCP server returned [] instead of proper format')
          console.log('Expected: {content: [{type: "text", text: "..."}]}')
          console.log('')
        }

        if (result.isError) {
          console.log('⚠️  Tool returned with isError flag set')
        }
      } catch (toolError: any) {
        console.error('❌ Tool call failed!')
        console.error('Error message:', toolError.message)

        if (toolError.message.includes('structured_content must be a dict')) {
          console.error('\n🐛 DIAGNOSIS: The MCP server has a bug!')
          console.error('It\'s returning [] (empty list) instead of proper MCP format.')
          console.error('\nThe server should return:')
          console.error('{\n  "content": [\n    {"type": "text", "text": "your data here"}\n  ]\n}')
        }

        console.error('\nFull error:', JSON.stringify(toolError, null, 2))
      }
    }

    // Close connection
    await client.close()
    console.log('\n✅ Tests complete')
    console.log(`\n📋 Summary:`)
    console.log(`  Server: ${connectedUrl}`)
    console.log(`  Dates tested: ${testDates.join(', ')}`)
    console.log('\nIf you saw "empty array" or "structured_content" errors,')
    console.log('the Garmin MCP server needs to be fixed to return proper format.')
  } catch (error: any) {
    console.error('❌ Test failed!')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

// Run the test
testGarminTool().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
