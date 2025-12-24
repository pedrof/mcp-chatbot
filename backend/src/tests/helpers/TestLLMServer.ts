import express, { Express } from 'express'
import { Server } from 'http'

interface ChatCompletionRequest {
  model: string
  messages: any[]
  tools?: any[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      tool_calls?: any[]
    }
    finish_reason: string
  }>
}

export class TestLLMServer {
  private app: Express
  private server: Server | null = null
  private responses: Map<string, ChatCompletionResponse> = new Map()
  private defaultResponse: ChatCompletionResponse
  public url: string = ''
  public requests: ChatCompletionRequest[] = []

  constructor() {
    this.app = express()
    this.app.use(express.json())

    this.defaultResponse = {
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: Date.now(),
      model: 'test-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a test response'
          },
          finish_reason: 'stop'
        }
      ]
    }

    // Models list endpoint
    this.app.get('/v1/models', (req, res) => {
      res.json({
        object: 'list',
        data: [{ id: 'test-model', object: 'model' }]
      })
    })

    // Chat completions endpoint
    this.app.post('/v1/chat/completions', (req, res) => {
      const request = req.body as ChatCompletionRequest
      this.requests.push(request)

      const lastMessage = request.messages[request.messages.length - 1]
      const prompt = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : ''

      // Look for custom response
      const response = this.responses.get(prompt) || this.defaultResponse

      if (request.stream) {
        // SSE streaming response
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        // Send content in chunks
        const content = response.choices[0].message.content || ''
        const words = content.split(' ')

        words.forEach((word, index) => {
          const chunk = {
            id: 'chatcmpl-test',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'test-model',
            choices: [
              {
                index: 0,
                delta: { content: word + (index < words.length - 1 ? ' ' : '') },
                finish_reason: null
              }
            ]
          }
          res.write(`data: ${JSON.stringify(chunk)}\n\n`)
        })

        // Send done
        const doneChunk = {
          id: 'chatcmpl-test',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'test-model',
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: response.choices[0].finish_reason
            }
          ]
        }
        res.write(`data: ${JSON.stringify(doneChunk)}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      } else {
        // Non-streaming response
        res.json(response)
      }
    })
  }

  setResponse(prompt: string, response: Partial<ChatCompletionResponse>): void {
    this.responses.set(prompt, {
      ...this.defaultResponse,
      ...response
    })
  }

  setDefaultResponse(response: Partial<ChatCompletionResponse>): void {
    this.defaultResponse = {
      ...this.defaultResponse,
      ...response
    }
  }

  clearRequests(): void {
    this.requests = []
  }

  getLastRequest(): ChatCompletionRequest | undefined {
    return this.requests[this.requests.length - 1]
  }

  async start(port: number = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, () => {
          const addr = this.server!.address()
          if (typeof addr === 'object' && addr !== null) {
            this.url = `http://localhost:${addr.port}/v1`
            resolve(this.url)
          } else {
            reject(new Error('Failed to get server address'))
          }
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      } else {
        resolve()
      }
    })
  }
}
