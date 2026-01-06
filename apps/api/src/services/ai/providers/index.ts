// AI Provider Factory - Creates the appropriate AI provider based on configuration

import type { AIProvider } from '../types.js';
import { AzureOpenAIProvider, type AzureOpenAIConfig } from './azureOpenAI.js';
import { PlaceholderProvider } from '../chatService.js';

export type AIProviderType = 'azure' | 'placeholder';

export interface AIProviderConfig {
  type: AIProviderType;
  azure?: AzureOpenAIConfig;
}

/**
 * Create an AI provider based on environment configuration
 */
export function createAIProvider(config?: AIProviderConfig): AIProvider {
  const providerType = config?.type || getProviderTypeFromEnv();

  switch (providerType) {
    case 'azure':
      return createAzureProvider(config?.azure);
    case 'placeholder':
    default:
      return new PlaceholderProvider();
  }
}

/**
 * Get provider type from environment variables
 */
function getProviderTypeFromEnv(): AIProviderType {
  const envProvider = process.env.AI_PROVIDER?.toLowerCase();

  if (envProvider === 'azure' || envProvider === 'azure-openai') {
    return 'azure';
  }

  return 'placeholder';
}

/**
 * Create Azure OpenAI provider from config or environment
 */
function createAzureProvider(config?: AzureOpenAIConfig): AIProvider {
  const azureConfig: AzureOpenAIConfig = {
    endpoint: config?.endpoint || process.env.AZURE_OPENAI_ENDPOINT || '',
    apiKey: config?.apiKey || process.env.AZURE_OPENAI_API_KEY || '',
    deployment: config?.deployment || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
    apiVersion: config?.apiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
  };

  // Validate required fields
  if (!azureConfig.endpoint) {
    console.warn('AZURE_OPENAI_ENDPOINT not configured, falling back to placeholder provider');
    return new PlaceholderProvider();
  }

  if (!azureConfig.apiKey) {
    console.warn('AZURE_OPENAI_API_KEY not configured, falling back to placeholder provider');
    return new PlaceholderProvider();
  }

  console.log(`Initializing Azure OpenAI provider with deployment: ${azureConfig.deployment}`);
  return new AzureOpenAIProvider(azureConfig);
}

/**
 * Check if a real AI provider is configured
 */
export function isAIConfigured(): boolean {
  const providerType = getProviderTypeFromEnv();

  if (providerType === 'azure') {
    return !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY);
  }

  return false;
}

/**
 * Get provider status information
 */
export function getProviderStatus(): {
  provider: string;
  configured: boolean;
  details: Record<string, unknown>;
} {
  const providerType = getProviderTypeFromEnv();

  if (providerType === 'azure') {
    const hasEndpoint = !!process.env.AZURE_OPENAI_ENDPOINT;
    const hasKey = !!process.env.AZURE_OPENAI_API_KEY;

    return {
      provider: 'azure-openai',
      configured: hasEndpoint && hasKey,
      details: {
        endpoint: hasEndpoint ? 'configured' : 'missing',
        apiKey: hasKey ? 'configured' : 'missing',
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'not specified',
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
      },
    };
  }

  return {
    provider: 'placeholder',
    configured: false,
    details: {
      message: 'No AI provider configured. Set AI_PROVIDER=azure and configure Azure OpenAI credentials.',
    },
  };
}

// Re-export types
export { AzureOpenAIProvider, type AzureOpenAIConfig } from './azureOpenAI.js';
