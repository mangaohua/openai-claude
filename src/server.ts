import http from 'http';
import express, { Request, Response } from 'express';
import axios from 'axios';
import { loadCodexConfig } from './config';
import {
  AnthropicRequest,
  AnthropicResponse,
  anthropicToAzureRequest,
  azureToAnthropicResponse,
} from './converters';

function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  const maybeFlush = (res as Response & { flush?: () => void }).flush;
  if (typeof maybeFlush === 'function') {
    maybeFlush.call(res);
  }
}

function streamAnthropicResponse(res: Response, response: AnthropicResponse): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  writeSseEvent(res, 'message_start', {
    type: 'message_start',
    message: {
      id: response.id,
      type: 'message',
      role: response.role,
      model: response.model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: response.usage,
    },
  });

  response.content.forEach((block, index) => {
    writeSseEvent(res, 'content_block_start', {
      type: 'content_block_start',
      index,
      content_block: block,
    });

    if (block.type === 'text') {
      if (block.text.length > 0) {
        writeSseEvent(res, 'content_block_delta', {
          type: 'content_block_delta',
          index,
          delta: {
            type: 'text_delta',
            text: block.text,
          },
        });
      }
    } else if (block.type === 'tool_use') {
      writeSseEvent(res, 'content_block_delta', {
        type: 'content_block_delta',
        index,
        delta: {
          type: 'input_json_delta',
          partial_json: JSON.stringify(block.input ?? {}),
        },
      });
    }

    writeSseEvent(res, 'content_block_stop', {
      type: 'content_block_stop',
      index,
    });
  });

  writeSseEvent(res, 'message_delta', {
    type: 'message_delta',
    delta: {
      stop_reason: response.stop_reason,
      stop_sequence: response.stop_sequence,
    },
    usage: response.usage,
  });

  writeSseEvent(res, 'message_stop', {
    type: 'message_stop',
  });

  res.end();
}
export interface ServerOptions {
  port?: number;
  host?: string;
}

export function startServer(options: ServerOptions = {}): http.Server {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const serverConfig = loadCodexConfig();
  const { azure } = serverConfig;

  const expectedAnthropicToken = process.env.ANTHROPIC_AUTH_TOKEN ?? null;
  const debugLogging = process.env.DEBUG === 'true';

  function buildAzureUrl(): string {
    const base = azure.baseUrl.replace(/\/$/, '');
    let url = `${base}/${azure.wireApi}`;
    if (azure.apiVersion) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}api-version=${encodeURIComponent(azure.apiVersion)}`;
    }
    return url;
  }

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post('/v1/messages', async (req: Request, res: Response) => {
    try {
      if (expectedAnthropicToken) {
        const providedToken =
          req.header('x-api-key') ??
          (req.header('authorization')?.startsWith('Bearer ')
            ? req.header('authorization')?.slice('Bearer '.length)
            : undefined);

        if (!providedToken || providedToken !== expectedAnthropicToken) {
          return res.status(401).json({ error: { message: 'Invalid or missing API key' } });
        }
      }

      const body = req.body as AnthropicRequest;
      const azureRequest = anthropicToAzureRequest(body, serverConfig.model, {
        defaultReasoningEffort: serverConfig.reasoningEffort,
      });

      if (debugLogging) {
        console.log('Anthropic request:', JSON.stringify(body));
        console.log('Azure request payload:', JSON.stringify(azureRequest));
      }
      const url = buildAzureUrl();

      const azureResponse = await axios.post(url, azureRequest, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': azure.apiKey,
        },
        timeout: 60_000,
      });

      const anthropicResponse = azureToAnthropicResponse(azureResponse.data, azureRequest.model);

      if (body.stream) {
        streamAnthropicResponse(res, anthropicResponse);
        return;
      }

      res.json(anthropicResponse);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? 500;
        const data = error.response?.data;
        res.status(status).json({
          error: {
            message:
              typeof data === 'string'
                ? data
                : data?.error?.message ??
                  data?.message ??
                  'Unexpected error from Azure OpenAI service',
          },
        });
        return;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: { message } });
    }
  });

  const host = options.host ?? process.env.HOST ?? '0.0.0.0';
  const port = options.port ?? (process.env.PORT ? Number(process.env.PORT) : 9999);
  const server = app.listen(port, host, () => {
    console.log(`Claude proxy server running on http://${host}:${port}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}
