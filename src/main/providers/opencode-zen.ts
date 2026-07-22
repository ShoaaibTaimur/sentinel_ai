import OpenAI from 'openai'
import { getApiKey, getModel } from '../store'

const BASE_URL = 'https://opencode.ai/zen/v1'

// Context limits per model (tokens)
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4o':                        128000,
  'gpt-4o-mini':                   128000,
  'o1':                            200000,
  'o1-mini':                       128000,
  'claude-3-5-sonnet-20241022':    200000,
  'claude-3-opus-20240229':        200000,
  'claude-3-haiku-20240307':       200000,
  'gemini-2.0-flash':             1048576,
  'gemini-1.5-pro':              2097152,
  'deepseek-chat':                  64000,
  'deepseek-coder':                 64000,
  'qwen-max':                       32000,
  'grok-2-latest':                131072,
  'kimi-latest':                   128000,
}

export const DEFAULT_CONTEXT_LIMIT = 128000

export const ZEN_MODELS = [
  { id: 'gpt-4o',                       name: 'GPT-4o',              provider: 'OpenAI' },
  { id: 'gpt-4o-mini',                  name: 'GPT-4o Mini',         provider: 'OpenAI' },
  { id: 'claude-3-5-sonnet-20241022',   name: 'Claude 3.5 Sonnet',   provider: 'Anthropic' },
  { id: 'gemini-2.0-flash',             name: 'Gemini 2.0 Flash',    provider: 'Google' },
  { id: 'deepseek-chat',                name: 'DeepSeek V3',         provider: 'DeepSeek' },
  { id: 'qwen-max',                     name: 'Qwen Max',            provider: 'Alibaba' },
  { id: 'grok-2-latest',                name: 'Grok 2',              provider: 'xAI' },
]

function getClient(): OpenAI {
  return new OpenAI({ apiKey: getApiKey(), baseURL: BASE_URL, timeout: 10 * 60 * 1000 })
}

export async function validateApiKey(key: string): Promise<boolean> {
  try {
    const client = new OpenAI({ apiKey: key, baseURL: BASE_URL })
    await client.models.list()
    return true
  } catch {
    return false
  }
}

export async function fetchModels(): Promise<typeof ZEN_MODELS> {
  try {
    const client = getClient()
    const response = await client.models.list()
    return response.data.map(m => ({
      id: m.id,
      name: m.id,
      provider: 'OpenCode Zen'
    }))
  } catch {
    return ZEN_MODELS
  }
}

export interface StreamResult {
  content: string
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null
}

export async function* streamChatWithUsage(
  messages: Array<any>,
  tools?: any[],
  options?: { signal?: AbortSignal }
): AsyncGenerator<{ token?: string; usage?: StreamResult['usage']; toolCalls?: any[] }> {
  const client = getClient()
  let stream: any = null
  let attempts = 0
  const maxAttempts = 3

  while (attempts < maxAttempts) {
    attempts++
    try {
      stream = await client.chat.completions.create({
        model: getModel(),
        messages,
        stream: true,
        tools: tools && tools.length > 0 ? tools : undefined,
        // Request usage in the final chunk
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stream_options: { include_usage: true } as any
      }, { signal: options?.signal })
      break
    } catch (err: any) {
      if (options?.signal?.aborted) throw err
      const status = err?.status || err?.statusCode
      const is5xx = typeof status === 'number' && status >= 500 && status < 600
      const isNetwork = err?.code === 'ECONNRESET' || err?.message?.includes('fetch failed') || err?.message?.includes('network')
      
      if ((is5xx || isNetwork) && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, attempts * 1000))
        continue
      }
      throw err
    }
  }

  if (!stream) return

  // Keep track of tool calls that are streamed
  const toolCallsAcc: any[] = []

  for await (const chunk of stream) {
    if (options?.signal?.aborted) break

    const delta = chunk.choices?.[0]?.delta
    const content = delta?.content
    if (content) yield { token: content }

    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const index = tc.index
        if (!toolCallsAcc[index]) {
          toolCallsAcc[index] = {
            id: tc.id,
            type: tc.type || 'function',
            function: { name: '', arguments: '' }
          }
        }
        if (tc.id) {
          toolCallsAcc[index].id = tc.id
        }
        if (tc.function?.name) {
          toolCallsAcc[index].function.name += tc.function.name
        }
        if (tc.function?.arguments) {
          toolCallsAcc[index].function.arguments += tc.function.arguments
        }
      }
    }

    // Usage arrives in last chunk
    if (chunk.usage) yield { usage: chunk.usage }
  }

  // Filter out any empty/undefined elements and yield if we accumulated any tool calls
  const finalToolCalls = toolCallsAcc.filter(Boolean)
  if (finalToolCalls.length > 0) {
    yield { toolCalls: finalToolCalls }
  }
}
