#!/usr/bin/env node

/**
 * CCAGI LLM MCP Server
 *
 * ローカルLLM（Starbose）およびOpenAI互換APIを呼び出すMCPサーバー
 *
 * 提供ツール:
 * - llm__chat - チャット形式でLLMを呼び出す
 * - llm__complete - テキスト補完を実行
 * - llm__code_generate - コード生成に特化した呼び出し
 * - llm__analyze - コード解析・レビュー
 * - llm__status - LLM接続状態確認
 *
 * サポートプロバイダー:
 * - starbose: Starbose LLM (ローカル/OpenAI互換)
 * - openai: OpenAI API
 * - anthropic: Anthropic Claude API
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// デフォルト設定
const DEFAULT_CONFIG = {
  starbose: {
    baseUrl: 'http://69.5.22.110/v1',
    model: 'openai/gpt-oss-120b',
    maxTokens: 4096,
    temperature: 0.7,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
    maxTokens: 4096,
    temperature: 0.7,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.7,
  },
};

// 設定読み込み
function loadConfig() {
  const cwd = process.cwd();
  const ccagiPath = join(cwd, '.ccagi.yml');

  let config = { ...DEFAULT_CONFIG };

  if (existsSync(ccagiPath)) {
    try {
      const content = readFileSync(ccagiPath, 'utf-8');
      // 簡易YAMLパース（llm設定部分のみ）
      const llmMatch = content.match(/llm:([\s\S]*?)(?=\n\w|$)/);
      if (llmMatch) {
        const baseUrlMatch = llmMatch[1].match(/base_url:\s*["']?([^"'\n]+)/);
        const modelMatch = llmMatch[1].match(/model:\s*["']?([^"'\n]+)/);
        if (baseUrlMatch) config.starbose.baseUrl = baseUrlMatch[1].trim();
        if (modelMatch) config.starbose.model = modelMatch[1].trim();
      }
    } catch (e) {
      // 設定ファイル読み込みエラーは無視
    }
  }

  // 環境変数で上書き
  if (process.env.STARBOSE_BASE_URL) {
    config.starbose.baseUrl = process.env.STARBOSE_BASE_URL;
  }
  if (process.env.STARBOSE_MODEL) {
    config.starbose.model = process.env.STARBOSE_MODEL;
  }
  if (process.env.OPENAI_API_KEY) {
    config.openai.apiKey = process.env.OPENAI_API_KEY;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    config.anthropic.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  return config;
}

/**
 * OpenAI互換APIを呼び出す
 */
async function callOpenAICompatible(baseUrl, messages, options = {}) {
  const endpoint = `${baseUrl}/chat/completions`;

  const body = {
    model: options.model || 'default',
    messages: messages,
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.7,
    stream: false,
  };

  if (options.systemPrompt) {
    body.messages = [
      { role: 'system', content: options.systemPrompt },
      ...messages,
    ];
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (options.apiKey) {
    headers['Authorization'] = `Bearer ${options.apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * プロバイダーに応じたLLM呼び出し
 */
async function callLLM(provider, messages, options = {}) {
  const config = loadConfig();

  switch (provider) {
    case 'starbose': {
      const providerConfig = config.starbose;
      return await callOpenAICompatible(providerConfig.baseUrl, messages, {
        model: options.model || providerConfig.model,
        maxTokens: options.maxTokens || providerConfig.maxTokens,
        temperature: options.temperature || providerConfig.temperature,
        systemPrompt: options.systemPrompt,
      });
    }

    case 'openai': {
      const providerConfig = config.openai;
      if (!providerConfig.apiKey) {
        throw new Error('OPENAI_API_KEY is not set');
      }
      return await callOpenAICompatible(providerConfig.baseUrl, messages, {
        model: options.model || providerConfig.model,
        maxTokens: options.maxTokens || providerConfig.maxTokens,
        temperature: options.temperature || providerConfig.temperature,
        systemPrompt: options.systemPrompt,
        apiKey: providerConfig.apiKey,
      });
    }

    case 'anthropic': {
      // Anthropic APIは別形式だが、ここでは未実装（Claude Codeから直接使用可能）
      throw new Error('Anthropic provider is not supported via this tool. Use Claude Code directly.');
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * LLM接続テスト
 */
async function testConnection(provider) {
  const config = loadConfig();
  const providerConfig = config[provider];

  if (!providerConfig) {
    return { success: false, error: `Unknown provider: ${provider}` };
  }

  try {
    const startTime = Date.now();
    const response = await callLLM(provider, [
      { role: 'user', content: 'Hello, respond with just "OK"' },
    ], { maxTokens: 10 });

    const elapsed = Date.now() - startTime;
    const content = response.choices?.[0]?.message?.content || '';

    return {
      success: true,
      provider,
      baseUrl: providerConfig.baseUrl,
      model: providerConfig.model,
      responseTime: elapsed,
      testResponse: content.substring(0, 50),
    };
  } catch (error) {
    return {
      success: false,
      provider,
      baseUrl: providerConfig.baseUrl,
      error: error.message,
    };
  }
}

// MCPサーバー設定
const server = new Server(
  {
    name: 'ccagi-llm',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ツール定義
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'llm__chat',
        description: 'ローカルLLM（Starbose）にチャット形式でリクエストを送信します。コード生成、質問応答、テキスト処理などに使用できます。',
        inputSchema: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                  content: { type: 'string' },
                },
                required: ['role', 'content'],
              },
              description: 'チャットメッセージの配列',
            },
            provider: {
              type: 'string',
              enum: ['starbose', 'openai'],
              description: 'LLMプロバイダー（デフォルト: starbose）',
              default: 'starbose',
            },
            model: {
              type: 'string',
              description: 'モデル名（オプション）',
            },
            maxTokens: {
              type: 'number',
              description: '最大トークン数',
              default: 4096,
            },
            temperature: {
              type: 'number',
              description: '温度パラメータ（0.0-2.0）',
              default: 0.7,
            },
          },
          required: ['messages'],
        },
      },
      {
        name: 'llm__complete',
        description: 'テキスト補完を実行します。プロンプトに続くテキストを生成します。',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: '補完するプロンプト',
            },
            provider: {
              type: 'string',
              enum: ['starbose', 'openai'],
              default: 'starbose',
            },
            maxTokens: {
              type: 'number',
              default: 2048,
            },
            temperature: {
              type: 'number',
              default: 0.7,
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'llm__code_generate',
        description: 'コード生成に特化したLLM呼び出し。言語、説明、コンテキストを指定してコードを生成します。',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: '生成したいコードの説明',
            },
            language: {
              type: 'string',
              description: 'プログラミング言語（typescript, python, go, etc.）',
              default: 'typescript',
            },
            context: {
              type: 'string',
              description: '追加のコンテキスト（既存コード、要件など）',
            },
            provider: {
              type: 'string',
              enum: ['starbose', 'openai'],
              default: 'starbose',
            },
            maxTokens: {
              type: 'number',
              default: 4096,
            },
          },
          required: ['description'],
        },
      },
      {
        name: 'llm__analyze',
        description: 'コード解析・レビューを実行します。コードの問題点、改善提案、セキュリティチェックを行います。',
        inputSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: '解析対象のコード',
            },
            analysisType: {
              type: 'string',
              enum: ['review', 'security', 'performance', 'refactor'],
              description: '解析タイプ',
              default: 'review',
            },
            language: {
              type: 'string',
              description: 'プログラミング言語',
            },
            provider: {
              type: 'string',
              enum: ['starbose', 'openai'],
              default: 'starbose',
            },
          },
          required: ['code'],
        },
      },
      {
        name: 'llm__status',
        description: 'LLM接続状態を確認します。Starbose LLMの疎通確認とレスポンス時間を測定します。',
        inputSchema: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['starbose', 'openai', 'all'],
              default: 'starbose',
            },
          },
        },
      },
    ],
  };
});

// ツール実行ハンドラー
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'llm__chat': {
        const { messages, provider = 'starbose', model, maxTokens, temperature } = args;

        const response = await callLLM(provider, messages, {
          model,
          maxTokens,
          temperature,
        });

        const content = response.choices?.[0]?.message?.content || '';
        const usage = response.usage || {};

        let resultText = `🤖 LLM Response (${provider})\n\n`;
        resultText += content;
        resultText += `\n\n---\n`;
        resultText += `Model: ${response.model || 'unknown'}\n`;
        resultText += `Tokens: ${usage.total_tokens || 'N/A'} (prompt: ${usage.prompt_tokens || 'N/A'}, completion: ${usage.completion_tokens || 'N/A'})`;

        return {
          content: [{ type: 'text', text: resultText }],
        };
      }

      case 'llm__complete': {
        const { prompt, provider = 'starbose', maxTokens, temperature } = args;

        const messages = [{ role: 'user', content: prompt }];
        const response = await callLLM(provider, messages, { maxTokens, temperature });

        const content = response.choices?.[0]?.message?.content || '';

        return {
          content: [{ type: 'text', text: content }],
        };
      }

      case 'llm__code_generate': {
        const { description, language = 'typescript', context, provider = 'starbose', maxTokens } = args;

        const systemPrompt = `You are an expert ${language} programmer. Generate clean, well-documented, production-ready code. Only output the code without explanations unless asked.`;

        let userPrompt = `Generate ${language} code for the following:\n\n${description}`;
        if (context) {
          userPrompt += `\n\nContext:\n${context}`;
        }

        const messages = [{ role: 'user', content: userPrompt }];
        const response = await callLLM(provider, messages, {
          maxTokens,
          temperature: 0.3, // Lower temperature for code generation
          systemPrompt,
        });

        const content = response.choices?.[0]?.message?.content || '';

        let resultText = `💻 Generated Code (${language})\n\n`;
        resultText += content;

        return {
          content: [{ type: 'text', text: resultText }],
        };
      }

      case 'llm__analyze': {
        const { code, analysisType = 'review', language, provider = 'starbose' } = args;

        const analysisPrompts = {
          review: 'Review this code for issues, bugs, and improvements. Provide specific feedback.',
          security: 'Analyze this code for security vulnerabilities. Check for OWASP Top 10 issues.',
          performance: 'Analyze this code for performance issues. Suggest optimizations.',
          refactor: 'Suggest refactoring improvements for this code. Focus on readability and maintainability.',
        };

        const systemPrompt = `You are a senior code reviewer. Provide detailed, actionable feedback.`;
        const userPrompt = `${analysisPrompts[analysisType]}\n\n${language ? `Language: ${language}\n\n` : ''}Code:\n\`\`\`\n${code}\n\`\`\``;

        const messages = [{ role: 'user', content: userPrompt }];
        const response = await callLLM(provider, messages, {
          maxTokens: 4096,
          temperature: 0.3,
          systemPrompt,
        });

        const content = response.choices?.[0]?.message?.content || '';

        let resultText = `📝 Code Analysis (${analysisType})\n\n`;
        resultText += content;

        return {
          content: [{ type: 'text', text: resultText }],
        };
      }

      case 'llm__status': {
        const { provider = 'starbose' } = args;
        const config = loadConfig();

        let resultText = '🔌 LLM Connection Status\n\n';

        if (provider === 'all') {
          // Test all providers
          for (const p of ['starbose', 'openai']) {
            const result = await testConnection(p);
            resultText += `=== ${p.toUpperCase()} ===\n`;
            if (result.success) {
              resultText += `Status: ✅ Connected\n`;
              resultText += `URL: ${result.baseUrl}\n`;
              resultText += `Model: ${result.model}\n`;
              resultText += `Response Time: ${result.responseTime}ms\n`;
              resultText += `Test Response: "${result.testResponse}"\n\n`;
            } else {
              resultText += `Status: ❌ Failed\n`;
              resultText += `URL: ${result.baseUrl || 'N/A'}\n`;
              resultText += `Error: ${result.error}\n\n`;
            }
          }
        } else {
          const result = await testConnection(provider);
          if (result.success) {
            resultText += `Provider: ${result.provider}\n`;
            resultText += `Status: ✅ Connected\n`;
            resultText += `Base URL: ${result.baseUrl}\n`;
            resultText += `Model: ${result.model}\n`;
            resultText += `Response Time: ${result.responseTime}ms\n`;
            resultText += `Test Response: "${result.testResponse}"\n`;
          } else {
            resultText += `Provider: ${result.provider}\n`;
            resultText += `Status: ❌ Connection Failed\n`;
            resultText += `Base URL: ${result.baseUrl || 'N/A'}\n`;
            resultText += `Error: ${result.error}\n`;
          }
        }

        resultText += '\n=== Configuration ===\n';
        resultText += `Starbose URL: ${config.starbose.baseUrl}\n`;
        resultText += `Starbose Model: ${config.starbose.model}\n`;
        resultText += `OpenAI API Key: ${config.openai.apiKey ? '✅ Set' : '❌ Not set'}\n`;

        return {
          content: [{ type: 'text', text: resultText }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ Error: ${error.message}` }],
      isError: true,
    };
  }
});

// サーバー起動
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CCAGI LLM MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
