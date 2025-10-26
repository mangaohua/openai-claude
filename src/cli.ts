#!/usr/bin/env node
import type { Server } from 'http';
import { startServer } from './server';
import packageJson from '../package.json';

interface CliOptions {
  host?: string;
  port?: number;
}

function printHelp(): void {
  const name = packageJson.name ?? 'openai-claude';
  console.log(
    `${name} v${packageJson.version}\n\n` +
      'Usage:\n' +
      '  openai-claude [options]\n\n' +
      'Options:\n' +
      '  -p, --port <number>   Port to listen on (defaults to 9999 or $PORT)\n' +
      '  -H, --host <host>     Host interface (defaults to 0.0.0.0 or $HOST)\n' +
      '  -h, --help            Show this message and exit\n' +
      '  -v, --version         Print version and exit\n',
  );
}

function parseArgs(argv: string[]): CliOptions | 'help' | 'version' | 'error' {
  const options: CliOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      return 'help';
    }
    if (arg === '-v' || arg === '--version') {
      return 'version';
    }
    if (arg === '-p' || arg === '--port') {
      const next = argv[i + 1];
      if (!next) {
        console.error('Missing value for port option.');
        return 'error';
      }
      const port = Number(next);
      if (!Number.isInteger(port) || port <= 0) {
        console.error(`Invalid port: ${next}`);
        return 'error';
      }
      options.port = port;
      i += 1;
      continue;
    }
    if (arg.startsWith('--port=')) {
      const value = arg.split('=', 2)[1];
      const port = Number(value);
      if (!Number.isInteger(port) || port <= 0) {
        console.error(`Invalid port: ${value}`);
        return 'error';
      }
      options.port = port;
      continue;
    }
    if (arg === '-H' || arg === '--host') {
      const next = argv[i + 1];
      if (!next) {
        console.error('Missing value for host option.');
        return 'error';
      }
      options.host = next;
      i += 1;
      continue;
    }
    if (arg.startsWith('--host=')) {
      options.host = arg.split('=', 2)[1];
      continue;
    }

    console.error(`Unknown argument: ${arg}`);
    return 'error';
  }

  return options;
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'help') {
    printHelp();
    return;
  }
  if (parsed === 'version') {
    console.log(packageJson.version ?? '0.0.0');
    return;
  }
  if (parsed === 'error') {
    printHelp();
    process.exitCode = 1;
    return;
  }

  let server: Server | null = null;

  try {
    server = startServer(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to start proxy server: ${message}`);
    process.exit(1);
  }

  const shutdown = (signal: NodeJS.Signals) => {
    console.log(`Received ${signal}. Shutting down...`);
    server?.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
