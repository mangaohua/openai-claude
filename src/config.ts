import fs from 'fs';
import os from 'os';
import path from 'path';
import toml from 'toml';

export interface AzureProviderConfig {
  name: string;
  baseUrl: string;
  envKey: string;
  wireApi: string;
  apiVersion?: string;
  apiKey: string;
}

export interface CodexConfig {
  model: string;
  modelProvider: string;
  azure: AzureProviderConfig;
}

export function loadCodexConfig(): CodexConfig {
  const configPath = path.join(os.homedir(), '.codex', 'config.toml');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}`);
  }

  const rawConfig = fs.readFileSync(configPath, 'utf8');
  const parsed = toml.parse(rawConfig) as any;

  const model = parsed?.model;
  const modelProvider = parsed?.model_provider;
  if (!modelProvider || modelProvider !== 'azure') {
    throw new Error(`Only 'azure' model_provider is supported. Found: ${modelProvider ?? 'undefined'}`);
  }

  const providerConfig = parsed?.model_providers?.[modelProvider];
  if (!providerConfig) {
    throw new Error(`Azure provider configuration missing in ${configPath}`);
  }

  const baseUrl = providerConfig?.base_url;
  const envKey = providerConfig?.env_key;
  const wireApi = providerConfig?.wire_api;
  const apiVersion = providerConfig?.api_version;

  if (!baseUrl || !envKey || !wireApi) {
    throw new Error(`Azure provider configuration missing required fields (base_url, env_key, wire_api)`);
  }

  const apiKey = process.env[envKey] ?? process.env.ANTHROPIC_AUTH_TOKEN;
  if (!apiKey) {
    throw new Error(
      `Environment variable ${envKey} (or fallback ANTHROPIC_AUTH_TOKEN) for Azure API key is not set`,
    );
  }

  return {
    model,
    modelProvider,
    azure: {
      name: providerConfig?.name ?? 'Azure OpenAI',
      baseUrl,
      envKey,
      wireApi,
      apiVersion,
      apiKey,
    },
  };
}
