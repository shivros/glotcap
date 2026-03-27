export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type StreamChatCompletionRequest = {
  messages: Array<ChatMessage>
  model?: string
  temperature?: number
  maxTokens?: number
}

export type LlmUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type LlmCompletionResult = {
  text: string
  usage?: LlmUsage
  model?: string
}

export type StreamingLlmClient = {
  stream: (request: StreamChatCompletionRequest) => AsyncIterable<string>
  complete?: (
    request: StreamChatCompletionRequest,
  ) => Promise<LlmCompletionResult>
}
