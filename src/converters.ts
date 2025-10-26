export type AnthropicTextBlock = {
  type: 'text';
  text: string;
};

export type AnthropicToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
};

export type AnthropicToolResultBlock = {
  type: 'tool_result';
  tool_use_id: string;
  content?: string | AnthropicTextBlock[];
  text?: string;
  is_error?: boolean;
  status?: string;
};

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export interface AnthropicMessage {
  role: 'user' | 'assistant' | 'system';
  content: AnthropicContentBlock[] | string;
}

export interface AnthropicToolDefinition {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export type AnthropicToolChoice =
  | 'auto'
  | 'none'
  | 'any'
  | {
      type: 'tool';
      name: string;
    };

export interface AnthropicRequest {
  model: string;
  system?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  stream?: boolean;
  messages: AnthropicMessage[];
  metadata?: Record<string, unknown>;
  tools?: AnthropicToolDefinition[];
  tool_choice?: AnthropicToolChoice;
  reasoning?: {
    effort?: string;
  };
}

export type AzureTextContentBlockType =
  | 'input_text'
  | 'output_text'
  | 'summary_text'
  | 'refusal'
  | 'input_image'
  | 'input_file'
  | 'computer_screenshot'
  | 'tether_browsing_display';

export interface AzureTextContentBlock {
  type: AzureTextContentBlockType;
  text: string;
}

export interface AzureToolCall {
  id?: string;
  type?: 'function';
  name?: string;
  arguments?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface AzureToolCallBlock {
  type: 'tool_calls';
  tool_calls: AzureToolCall[];
}

export type AzureContentBlock = AzureTextContentBlock | AzureToolCallBlock;

export interface AzureMessageInput {
  type: 'message';
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: AzureContentBlock[];
  tool_call_id?: string;
}

export interface AzureFunctionCallOutput {
  type: 'function_call_output';
  call_id: string;
  output: string;
}

export interface AzureFunctionCallInput {
  type: 'function_call';
  call_id?: string;
  name: string;
  arguments: string;
}

export type AzureInputItem = AzureMessageInput | AzureFunctionCallOutput | AzureFunctionCallInput;

export interface AzureToolDefinition {
  type: string;
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AzureToolChoice {
  type: 'auto' | 'none' | 'required' | 'function';
  name?: string;
}

export interface AzureResponsesRequestBody {
  model: string;
  input: AzureInputItem[];
  temperature?: number;
  top_p?: number;
  stop?: string[];
  max_output_tokens?: number;
  metadata?: Record<string, unknown>;
  tools?: AzureToolDefinition[];
  tool_choice?: AzureToolChoice | 'auto' | 'none' | 'required';
  reasoning?: {
    effort?: string;
  };
}

export interface AzureUsage {
  completion_tokens?: number;
  prompt_tokens?: number;
  total_tokens?: number;
  output_tokens?: number;
  input_tokens?: number;
}

export interface AzureResponseOutputMessage {
  id?: string;
  type: 'message';
  role: 'assistant' | 'user' | 'system';
  content: AzureContentBlock[];
  stop_reason?: string | null;
}

export interface AzureResponseFunctionCall {
  id?: string;
  type: 'function_call';
  call_id?: string;
  name?: string;
  arguments?: string;
}

export type AzureResponseOutputItem = AzureResponseOutputMessage | AzureResponseFunctionCall;

export interface AzureResponsesResponseBody {
  id?: string;
  model?: string;
  output?: AzureResponseOutputItem[];
  usage?: AzureUsage;
  output_text?: string;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: AnthropicContentBlock[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

function normalizeToString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeToString(item)).join('');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function normalizeMessageContent(content: AnthropicMessage['content']): AnthropicContentBlock[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: normalizeToString(content) }];
  }

  if (!Array.isArray(content)) {
    throw new Error('Message content must be a string or an array of content blocks');
  }

  return content.map((item) => {
    if (typeof item === 'string') {
      return { type: 'text', text: normalizeToString(item) };
    }
    if (!item || typeof item !== 'object' || !('type' in item)) {
      throw new Error('Unsupported content block format');
    }

    const block = item as AnthropicContentBlock;
    switch (block.type) {
      case 'text':
        return { type: 'text', text: normalizeToString(block.text) };
      case 'tool_use':
        if (!('id' in block) || !('name' in block)) {
          throw new Error('tool_use block must include id and name');
        }
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input ?? {},
        };
      case 'tool_result':
        if (!('tool_use_id' in block)) {
          throw new Error('tool_result block must include tool_use_id');
        }
        return {
          type: 'tool_result',
          tool_use_id: block.tool_use_id,
          content: block.content,
          text: block.text,
          is_error: block.is_error,
          status: block.status,
        };
      default:
        throw new Error(`Unsupported content block type: ${(block as { type: string }).type}`);
    }
  });
}

function serializeToolResultOutput(block: AnthropicToolResultBlock): string {
  if (typeof block.content === 'string') {
    return block.content;
  }

  if (Array.isArray(block.content)) {
    return block.content.map((part) => normalizeToString(part.text)).join('');
  }

  if (typeof block.text === 'string') {
    return block.text;
  }

  const payload: Record<string, unknown> = {};
  if (block.content !== undefined) {
    payload.content = block.content;
  }
  if (block.is_error !== undefined) {
    payload.is_error = block.is_error;
  }
  if (block.status !== undefined) {
    payload.status = block.status;
  }

  return JSON.stringify({
    tool_use_id: block.tool_use_id,
    ...payload,
  });
}

function anthropicToolsToAzure(
  tools: AnthropicToolDefinition[] | undefined,
): AzureToolDefinition[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  return tools.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters:
      tool.input_schema && Object.keys(tool.input_schema).length > 0
        ? tool.input_schema
        : { type: 'object', properties: {} },
  }));
}

function anthropicToolChoiceToAzure(
  toolChoice: AnthropicToolChoice | undefined,
): AzureResponsesRequestBody['tool_choice'] {
  if (!toolChoice) {
    return undefined;
  }

  if (toolChoice === 'auto') {
    return 'auto';
  }
  if (toolChoice === 'none') {
    return 'none';
  }
  if (toolChoice === 'any') {
    return 'required';
  }

  if (toolChoice.type === 'tool') {
    return {
      type: 'function',
      name: toolChoice.name,
    };
  }

  return undefined;
}

function safeJsonParse<T = unknown>(value: string | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function anthropicToAzureRequest(
  body: AnthropicRequest,
  fallbackModel: string,
  options?: { defaultReasoningEffort?: string },
): AzureResponsesRequestBody {
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new Error('Anthropic request must include at least one message');
  }

  const input: AzureInputItem[] = [];

  if (body.system) {
    input.push({
      type: 'message',
      role: 'system',
      content: [{ type: 'input_text', text: normalizeToString(body.system) }],
    });
  }

  for (const message of body.messages) {
    const blocks = normalizeMessageContent(message.content);

    let textAccumulator: string[] = [];
    const flushText = () => {
      if (textAccumulator.length === 0) {
        return;
      }
      const role = message.role;
      const contentType: AzureTextContentBlockType =
        role === 'assistant' ? 'output_text' : 'input_text';

      input.push({
        type: 'message',
        role,
        content: [
          {
            type: contentType,
            text: textAccumulator.join(''),
          },
        ],
      });
      textAccumulator = [];
    };

    for (const block of blocks) {
      switch (block.type) {
        case 'text':
          textAccumulator.push(block.text);
          break;
        case 'tool_use':
          flushText();
          input.push({
            type: 'function_call',
            call_id: block.id,
            name: block.name,
            arguments: JSON.stringify(block.input ?? {}),
          });
          break;
        case 'tool_result':
          flushText();
          input.push({
            type: 'function_call_output',
            call_id: block.tool_use_id,
            output: serializeToolResultOutput(block),
          });
          break;
        default:
          throw new Error(`Unsupported content block type: ${(block as { type: string }).type}`);
      }
    }

    flushText();
  }

  const requestedModel =
    (typeof body.model === 'string' && body.model.trim().length > 0 ? body.model : fallbackModel) ??
    '';

  if (!requestedModel) {
    throw new Error('No model specified in request or config');
  }

  const azureRequest: AzureResponsesRequestBody = {
    model: requestedModel,
    input,
  };

  if (typeof body.temperature === 'number') {
    azureRequest.temperature = body.temperature;
  }
  if (typeof body.top_p === 'number') {
    azureRequest.top_p = body.top_p;
  }
  if (Array.isArray(body.stop_sequences) && body.stop_sequences.length > 0) {
    azureRequest.stop = body.stop_sequences;
  }
  if (typeof body.max_tokens === 'number') {
    azureRequest.max_output_tokens = body.max_tokens;
  }
  if (body.metadata) {
    azureRequest.metadata = body.metadata;
  }

  const reasoningEffort = body.reasoning?.effort ?? options?.defaultReasoningEffort;
  if (typeof reasoningEffort === 'string' && reasoningEffort.trim().length > 0) {
    azureRequest.reasoning = { effort: reasoningEffort };
  }

  const azureTools = anthropicToolsToAzure(body.tools);
  if (azureTools) {
    azureRequest.tools = azureTools;
  }

  const toolChoice = anthropicToolChoiceToAzure(body.tool_choice);
  if (toolChoice) {
    azureRequest.tool_choice = toolChoice;
  }

  return azureRequest;
}

function mapStopReason(responseStopReason: string | null | undefined, hasToolCall: boolean): string {
  if (responseStopReason) {
    return responseStopReason;
  }
  if (hasToolCall) {
    return 'tool_use';
  }
  return 'end_turn';
}

export function azureToAnthropicResponse(
  data: AzureResponsesResponseBody,
  requestedModel: string,
): AnthropicResponse {
  const contentBlocks: AnthropicContentBlock[] = [];
  let stopReason: string | null = null;

  const processedToolCallIds = new Set<string>();

  for (const item of data.output ?? []) {
    if (!item) {
      continue;
    }

    if (item.type === 'message') {
      const message = item as AzureResponseOutputMessage;
      for (const block of message.content ?? []) {
        if (!block) {
          continue;
        }

        if (block.type === 'output_text' || block.type === 'summary_text') {
          contentBlocks.push({
            type: 'text',
            text: normalizeToString(block.text),
          });
        } else if (block.type === 'tool_calls') {
          for (const call of block.tool_calls ?? []) {
            const callName = call.name ?? call.function?.name ?? 'tool';
            const callId = call.id ?? callName ?? `tool_${contentBlocks.length}`;
            processedToolCallIds.add(callId);
            contentBlocks.push({
              type: 'tool_use',
              id: callId,
              name: callName,
              input: safeJsonParse(call.arguments ?? call.function?.arguments, {}),
            });
          }
        }
      }

      if (!stopReason) {
        stopReason = mapStopReason(message.stop_reason, processedToolCallIds.size > 0);
      }
    } else if (item.type === 'function_call') {
      const call = item as AzureResponseFunctionCall;
      const callName = call.name ?? 'tool';
      const callId = call.call_id ?? call.id ?? callName ?? `tool_${processedToolCallIds.size}`;
      if (processedToolCallIds.has(callId)) {
        continue;
      }
      processedToolCallIds.add(callId);
      contentBlocks.push({
        type: 'tool_use',
        id: callId,
        name: callName,
        input: safeJsonParse(call.arguments, {}),
      });
      if (!stopReason) {
        stopReason = 'tool_use';
      }
    }
  }

  if (contentBlocks.length === 0) {
    contentBlocks.push({
      type: 'text',
      text: data.output_text ?? '',
    });
  }

  if (!stopReason) {
    stopReason = 'end_turn';
  }

  const usage = data.usage ?? {};
  const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;

  return {
    id: data.id ?? 'proxy-response',
    type: 'message',
    role: 'assistant',
    model: data.model ?? requestedModel,
    content: contentBlocks,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  };
}
