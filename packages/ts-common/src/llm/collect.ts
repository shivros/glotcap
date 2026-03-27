import type {
  LlmCompletionResult,
  StreamChatCompletionRequest,
  StreamingLlmClient,
} from './types'

export const collectStream = async (
  client: StreamingLlmClient,
  request: StreamChatCompletionRequest,
): Promise<string> => {
  let output = ''
  for await (const chunk of client.stream(request)) {
    output += chunk
  }
  const trimmed = output.trim()
  if (!trimmed) {
    throw new Error('LLM returned an empty response.')
  }
  return trimmed
}

export const collectCompletion = async (
  client: StreamingLlmClient,
  request: StreamChatCompletionRequest,
): Promise<LlmCompletionResult> => {
  if (typeof client.complete === 'function') {
    return client.complete(request)
  }

  const text = await collectStream(client, request)
  return { text }
}
