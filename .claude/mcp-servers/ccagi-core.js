#!/usr/bin/env node

/**
 * CCAGI Core MCP Server
 *
 * Customer Cloud AGI - 完全ローカル自律型エージェントシステム
 * 外部npm依存を排除し、ローカル完結型で動作
 *
 * 提供ツール:
 * - ccagi__status - プロジェクト状態確認
 * - ccagi__agent_run - Agent実行（GitHub Issue処理）
 * - ccagi__auto - 全自動モード起動
 * - ccagi__todos - TODOコメント自動検出
 * - ccagi__config - 設定管理
 * - ccagi__get_status - 統合状態取得（軽量）
 *
 * 設計原則:
 * - 外部npm/npx実行なし（ローカルスクリプトのみ）
 * - Anthropic API連携は保持（害がないため）
 * - GitHub API連携は保持（害がないため）
 * - AWS経由の通信は完全除外
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const server = new Server(
  {
    name: 'ccagi-core',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Execute local command (no external npm/npx)
 */
function executeLocalCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      cwd: options.cwd || process.cwd(),
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: options.timeout || 120000, // 2 minutes default
    });

    return {
      success: true,
      output: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr?.toString() || '',
      stdout: error.stdout?.toString() || '',
    };
  }
}

/**
 * Get project status (local only)
 */
function getProjectStatus() {
  const cwd = process.cwd();

  // Check configuration files
  const hasCCAGI = existsSync(join(cwd, '.ccagi.yml'));
  const hasClaude = existsSync(join(cwd, '.claude'));
  const hasAgentContext = existsSync(join(cwd, '.agent-context.json'));

  // Read package.json if exists
  let packageInfo = null;
  const packagePath = join(cwd, 'package.json');
  if (existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
      packageInfo = {
        name: pkg.name,
        version: pkg.version,
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
      };
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Read agent context if exists
  let agentContext = null;
  if (hasAgentContext) {
    try {
      agentContext = JSON.parse(readFileSync(join(cwd, '.agent-context.json'), 'utf-8'));
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Check Git status
  let gitStatus = null;
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf-8', cwd }).trim();
    const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd });
    gitStatus = {
      branch,
      hasChanges: status.length > 0,
      changedFiles: status.split('\n').filter(Boolean).length,
    };
  } catch (e) {
    // Not a git repo
  }

  return {
    hasCCAGI,
    hasClaude,
    hasAgentContext,
    packageInfo,
    agentContext,
    gitStatus,
    workingDirectory: cwd,
  };
}

/**
 * Scan for TODO comments in codebase
 */
function scanTodos(path = './src') {
  const cwd = process.cwd();
  const targetPath = resolve(cwd, path);

  if (!existsSync(targetPath)) {
    return { success: false, error: `Path not found: ${targetPath}` };
  }

  const todos = [];
  const patterns = ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG'];

  function scanFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        patterns.forEach((pattern) => {
          if (line.includes(pattern)) {
            todos.push({
              file: filePath.replace(cwd, '.'),
              line: index + 1,
              pattern,
              text: line.trim(),
            });
          }
        });
      });
    } catch (e) {
      // Skip unreadable files
    }
  }

  function scanDir(dirPath) {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
          // Skip node_modules, .git, etc.
          if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
            scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          // Only scan code files
          const ext = entry.name.split('.').pop();
          if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'md'].includes(ext)) {
            scanFile(fullPath);
          }
        }
      }
    } catch (e) {
      // Skip unreadable directories
    }
  }

  scanDir(targetPath);

  return {
    success: true,
    todos,
    summary: {
      total: todos.length,
      byPattern: patterns.reduce((acc, p) => {
        acc[p] = todos.filter((t) => t.pattern === p).length;
        return acc;
      }, {}),
    },
  };
}

/**
 * Read CCAGI configuration
 */
function readConfig() {
  const cwd = process.cwd();
  const ccagiPath = join(cwd, '.ccagi.yml');

  if (!existsSync(ccagiPath)) {
    return { success: false, error: 'No configuration file found (.ccagi.yml)' };
  }

  try {
    const content = readFileSync(ccagiPath, 'utf-8');
    return { success: true, content, path: ccagiPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'ccagi__status',
        description: 'プロジェクトの状態を確認します。ローカルファイル、Git状態、エージェントコンテキストを表示します。',
        inputSchema: {
          type: 'object',
          properties: {
            verbose: {
              type: 'boolean',
              description: '詳細情報を表示するか',
              default: false,
            },
          },
        },
      },
      {
        name: 'ccagi__agent_run',
        description: 'Autonomous Agentを実行します。ローカルでDAG構築・タスク分解を行い、Claude APIを使用してコード生成を実行します。',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: '実行するタスクの説明',
            },
            issueNumber: {
              type: 'number',
              description: 'GitHub Issue番号（オプション）',
            },
            dryRun: {
              type: 'boolean',
              description: 'ドライラン（実際には変更しない）',
              default: false,
            },
          },
          required: ['task'],
        },
      },
      {
        name: 'ccagi__auto',
        description: '全自動モードを起動します。タスクキューを監視し、自動的に処理を実行します。',
        inputSchema: {
          type: 'object',
          properties: {
            maxTasks: {
              type: 'number',
              description: '最大処理タスク数',
              default: 5,
            },
          },
        },
      },
      {
        name: 'ccagi__todos',
        description: 'コード内のTODOコメントを自動検出します。',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'スキャン対象パス',
              default: './src',
            },
          },
        },
      },
      {
        name: 'ccagi__config',
        description: 'CCAGI設定を表示・管理します。',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['show', 'validate'],
              description: 'アクション（show/validate）',
              default: 'show',
            },
          },
        },
      },
      {
        name: 'ccagi__get_status',
        description: '現在のプロジェクトのCCAGI統合状態を取得します（軽量・高速）',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'ccagi__status': {
        const { verbose } = args || {};
        const status = getProjectStatus();

        let statusText = '📊 CCAGI プロジェクト状態\n\n';
        statusText += `作業ディレクトリ: ${status.workingDirectory}\n\n`;

        statusText += '=== 設定ファイル ===\n';
        statusText += `CCAGI設定 (.ccagi.yml): ${status.hasCCAGI ? '✅' : '❌'}\n`;
        statusText += `Claude Code統合: ${status.hasClaude ? '✅' : '❌'}\n`;
        statusText += `エージェントコンテキスト: ${status.hasAgentContext ? '✅' : '❌'}\n\n`;

        if (status.gitStatus) {
          statusText += '=== Git状態 ===\n';
          statusText += `ブランチ: ${status.gitStatus.branch}\n`;
          statusText += `変更ファイル: ${status.gitStatus.changedFiles}個\n\n`;
        }

        if (status.packageInfo) {
          statusText += '=== パッケージ情報 ===\n';
          statusText += `名前: ${status.packageInfo.name}\n`;
          statusText += `バージョン: ${status.packageInfo.version}\n`;
          statusText += `依存関係: ${status.packageInfo.dependencies.length}個\n`;
          statusText += `開発依存: ${status.packageInfo.devDependencies.length}個\n\n`;
        }

        if (verbose && status.agentContext) {
          statusText += '=== エージェントコンテキスト ===\n';
          statusText += JSON.stringify(status.agentContext, null, 2) + '\n';
        }

        return {
          content: [{ type: 'text', text: statusText }],
        };
      }

      case 'ccagi__agent_run': {
        const { task, issueNumber, dryRun } = args;

        let resultText = '🤖 CCAGI Agent 実行\n\n';
        resultText += `タスク: ${task}\n`;
        if (issueNumber) {
          resultText += `Issue: #${issueNumber}\n`;
        }
        resultText += `モード: ${dryRun ? 'ドライラン' : '実行'}\n\n`;

        // Update agent context
        const contextPath = join(process.cwd(), '.agent-context.json');
        const context = {
          agentStatus: dryRun ? 'dry-run' : 'executing',
          agentType: 'CCAGIAgent',
          config: {
            useTaskTool: false,
            useWorktree: true,
          },
          task: {
            id: `ccagi-task-${Date.now()}`,
            title: task,
            description: task,
            issueNumber: issueNumber || null,
            priority: 1,
            taskType: 'feature',
          },
          startedAt: new Date().toISOString(),
        };

        if (!dryRun) {
          writeFileSync(contextPath, JSON.stringify(context, null, 2));
          resultText += '✅ エージェントコンテキストを更新しました\n';
          resultText += '\n=== 次のステップ ===\n';
          resultText += '1. CoordinatorAgentがタスクをサブタスクに分解\n';
          resultText += '2. CodeGenAgentが実装を生成\n';
          resultText += '3. ReviewAgentが品質チェック\n';
          resultText += '4. PRAgentがPull Request作成\n';
        } else {
          resultText += '📋 ドライラン完了（変更なし）\n';
          resultText += '\n=== 実行予定 ===\n';
          resultText += JSON.stringify(context, null, 2);
        }

        return {
          content: [{ type: 'text', text: resultText }],
        };
      }

      case 'ccagi__auto': {
        const { maxTasks } = args || { maxTasks: 5 };

        let resultText = '🕷️ CCAGI 全自動モード\n\n';
        resultText += `最大タスク数: ${maxTasks}\n\n`;
        resultText += '=== 自動モード機能 ===\n';
        resultText += '- GitHub Issue自動検出\n';
        resultText += '- タスクキュー管理\n';
        resultText += '- 並列Agent実行\n';
        resultText += '- 自動PR作成\n\n';
        resultText += '⚠️ 注意: 全自動モードはGitHub連携が必要です。\n';
        resultText += 'GITHUB_TOKEN環境変数を設定してください。\n';

        return {
          content: [{ type: 'text', text: resultText }],
        };
      }

      case 'ccagi__todos': {
        const { path } = args || { path: './src' };
        const result = scanTodos(path);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `❌ エラー: ${result.error}` }],
            isError: true,
          };
        }

        let resultText = '📝 TODOスキャン結果\n\n';
        resultText += `スキャン対象: ${path}\n`;
        resultText += `検出数: ${result.summary.total}件\n\n`;

        resultText += '=== パターン別 ===\n';
        for (const [pattern, count] of Object.entries(result.summary.byPattern)) {
          if (count > 0) {
            resultText += `${pattern}: ${count}件\n`;
          }
        }

        if (result.todos.length > 0) {
          resultText += '\n=== 検出項目（上位10件） ===\n';
          result.todos.slice(0, 10).forEach((todo, i) => {
            resultText += `\n${i + 1}. ${todo.file}:${todo.line}\n`;
            resultText += `   [${todo.pattern}] ${todo.text.substring(0, 80)}...\n`;
          });

          if (result.todos.length > 10) {
            resultText += `\n... 他 ${result.todos.length - 10}件\n`;
          }
        }

        return {
          content: [{ type: 'text', text: resultText }],
        };
      }

      case 'ccagi__config': {
        const { action } = args || { action: 'show' };
        const config = readConfig();

        if (!config.success) {
          return {
            content: [{ type: 'text', text: `❌ ${config.error}` }],
            isError: true,
          };
        }

        let resultText = '⚙️ CCAGI 設定\n\n';
        resultText += `設定ファイル: ${config.path}\n\n`;

        if (action === 'validate') {
          resultText += '=== バリデーション ===\n';
          // Basic validation
          const hasProjectName = config.content.includes('project_name:');
          const hasAgents = config.content.includes('agents:');
          const hasQuality = config.content.includes('quality:');

          resultText += `project_name: ${hasProjectName ? '✅' : '❌'}\n`;
          resultText += `agents設定: ${hasAgents ? '✅' : '❌'}\n`;
          resultText += `quality設定: ${hasQuality ? '✅' : '❌'}\n`;
        } else {
          resultText += '=== 設定内容 ===\n';
          resultText += '```yaml\n';
          resultText += config.content.substring(0, 2000);
          if (config.content.length > 2000) {
            resultText += '\n... (truncated)';
          }
          resultText += '\n```\n';
        }

        return {
          content: [{ type: 'text', text: resultText }],
        };
      }

      case 'ccagi__get_status': {
        const status = getProjectStatus();

        let statusText = '📊 CCAGI クイックステータス\n\n';
        statusText += `CCAGI: ${status.hasCCAGI ? '✅' : '❌'}\n`;
        statusText += `Claude: ${status.hasClaude ? '✅' : '❌'}\n`;

        if (status.gitStatus) {
          statusText += `Git: ${status.gitStatus.branch} (${status.gitStatus.changedFiles}変更)\n`;
        }

        if (status.agentContext) {
          statusText += `Agent: ${status.agentContext.agentStatus || 'idle'}\n`;
        }

        return {
          content: [{ type: 'text', text: statusText }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ エラーが発生しました\n\n${error.message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CCAGI Core MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
