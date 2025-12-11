#!/usr/bin/env node

/**
 * CCAGI Integration MCP Server
 *
 * Claude Code内でCCAGI CLIの全機能を直接呼び出せるMCPサーバー
 * Miyabi互換 + CCAGI独自機能を統合
 *
 * 提供ツール:
 * - ccagi__init - 新規プロジェクト作成
 * - ccagi__install - 既存プロジェクトにインストール
 * - ccagi__status - ステータス確認
 * - ccagi__agent_run - Agent実行
 * - ccagi__agent_coordinate - CoordinatorAgent統合実行
 * - ccagi__auto - 全自動モード起動
 * - ccagi__todos - TODOコメント自動検出
 * - ccagi__config - 設定管理
 * - ccagi__get_status - クイックステータス
 * - ccagi__fetch_issue - GitHub Issue取得
 * - ccagi__execute_dag - DAG実行制御
 *
 * @see CLAUDE.md
 * @license MIT
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

const server = new Server(
  {
    name: 'ccagi-integration',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * ローカルCCAGIコマンドを実行（外部npx禁止ポリシー準拠）
 */
function executeCCAGICommand(command, options = {}) {
  try {
    // ローカルのbin/ccagi.jsを直接実行
    const ccagiPath = join(PROJECT_ROOT, 'bin', 'ccagi.js');
    const cmd = `node "${ccagiPath}" ${command}`;

    const result = execSync(cmd, {
      encoding: 'utf-8',
      cwd: options.cwd || PROJECT_ROOT,
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: options.timeout || 120000, // 2分デフォルト
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
 * GitHub CLIでIssueを取得
 */
function fetchGitHubIssue(issueNumber) {
  try {
    const result = execSync(
      `gh issue view ${issueNumber} --json number,title,body,labels,assignees,state`,
      {
        encoding: 'utf-8',
        cwd: PROJECT_ROOT,
        timeout: 30000,
      }
    );
    return {
      success: true,
      issue: JSON.parse(result),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * GitHub Issueにコメントを追加
 */
function addIssueComment(issueNumber, body) {
  try {
    execSync(`gh issue comment ${issueNumber} --body "${body.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
      timeout: 30000,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * プロジェクトステータスを取得
 */
function getProjectStatus() {
  const cwd = PROJECT_ROOT;

  // .ccagi.yml存在確認
  const hasCCAGI = existsSync(join(cwd, '.ccagi.yml'));

  // .claude/ディレクトリ存在確認
  const hasClaude = existsSync(join(cwd, '.claude'));

  // .github/workflows存在確認
  const hasWorkflows = existsSync(join(cwd, '.github', 'workflows'));

  // package.json読み込み
  let packageInfo = null;
  const packagePath = join(cwd, 'package.json');
  if (existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
      packageInfo = {
        name: pkg.name,
        version: pkg.version,
        dependencies: Object.keys(pkg.dependencies || {}).length,
        devDependencies: Object.keys(pkg.devDependencies || {}).length,
      };
    } catch (e) {
      // Ignore parse errors
    }
  }

  // エージェント定義数
  const agentsDir = join(cwd, '.claude-plugin', 'agents');
  let agentCount = 0;
  if (existsSync(agentsDir)) {
    try {
      const files = execSync(`ls -1 "${agentsDir}"/*.md 2>/dev/null | wc -l`, {
        encoding: 'utf-8',
      });
      agentCount = parseInt(files.trim(), 10) || 0;
    } catch (e) {
      // Ignore
    }
  }

  return {
    hasCCAGI,
    hasClaude,
    hasWorkflows,
    packageInfo,
    agentCount,
    workingDirectory: cwd,
  };
}

/**
 * Issue本文からタスクを抽出（coordinator-agent.jsと同じロジック）
 */
function extractTasksFromIssue(issueBody) {
  const tasks = [];
  const lines = issueBody.split('\n');

  let taskId = 1;
  for (const line of lines) {
    // チェックボックス形式
    const checkboxMatch = line.match(/^-\s*\[[ x]\]\s*(.+)$/);
    if (checkboxMatch) {
      const description = checkboxMatch[1].trim();
      const dependsMatch = description.match(/\(depends:\s*#(\d+)\)/);
      tasks.push({
        id: `task-${taskId++}`,
        description: description.replace(/\(depends:.*?\)/, '').trim(),
        dependencies: dependsMatch ? [`#${dependsMatch[1]}`] : [],
      });
      continue;
    }

    // 番号付きリスト
    const numberedMatch = line.match(/^\d+\.\s*(.+)$/);
    if (numberedMatch) {
      const description = numberedMatch[1].trim();
      const dependsMatch = description.match(/\(depends:\s*#(\d+)\)/);
      tasks.push({
        id: `task-${taskId++}`,
        description: description.replace(/\(depends:.*?\)/, '').trim(),
        dependencies: dependsMatch ? [`#${dependsMatch[1]}`] : [],
      });
      continue;
    }

    // 見出し形式
    const headingMatch = line.match(/^##\s*(.+)$/);
    if (headingMatch) {
      const description = headingMatch[1].trim();
      const dependsMatch = description.match(/\(depends:\s*#(\d+)\)/);
      tasks.push({
        id: `task-${taskId++}`,
        description: description.replace(/\(depends:.*?\)/, '').trim(),
        dependencies: dependsMatch ? [`#${dependsMatch[1]}`] : [],
      });
    }
  }

  return tasks;
}

/**
 * タスク種別判定
 */
const TASK_TYPE_KEYWORDS = {
  feature: ['feature', 'add', 'new', 'implement', '実装', '追加', '新機能'],
  bug: ['bug', 'fix', 'error', 'issue', 'バグ', '修正', 'エラー'],
  refactor: ['refactor', 'cleanup', 'improve', 'リファクタ', '改善'],
  docs: ['doc', 'documentation', 'readme', 'ドキュメント', '文書'],
  test: ['test', 'spec', 'coverage', 'テスト'],
  deployment: ['deploy', 'release', 'publish', 'デプロイ', 'リリース'],
  security: ['security', 'vulnerability', 'セキュリティ', '脆弱性'],
};

function determineTaskType(taskDescription) {
  const desc = taskDescription.toLowerCase();
  for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    if (keywords.some(keyword => desc.includes(keyword))) {
      return type;
    }
  }
  return 'feature';
}

/**
 * Severity判定
 */
const SEVERITY_KEYWORDS = {
  'Sev.1-Critical': ['critical', 'urgent', 'blocking', '緊急', 'クリティカル'],
  'Sev.2-High': ['high priority', 'important', '重要', '高優先'],
  'Sev.4-Low': ['minor', 'small', '軽微', '小さい'],
  'Sev.5-Trivial': ['nice to have', 'optional', 'あれば良い'],
};

function determineSeverity(taskDescription) {
  const desc = taskDescription.toLowerCase();
  for (const [severity, keywords] of Object.entries(SEVERITY_KEYWORDS)) {
    if (keywords.some(keyword => desc.includes(keyword))) {
      return severity;
    }
  }
  return 'Sev.3-Medium';
}

/**
 * Agent割り当て
 */
function assignAgent(taskType) {
  const agentMapping = {
    feature: 'CodeGenAgent',
    bug: 'CodeGenAgent',
    refactor: 'CodeGenAgent',
    docs: 'CodeGenAgent',
    test: 'TestAgent',
    deployment: 'DeploymentAgent',
    security: 'SecurityAgent',
  };
  return agentMapping[taskType] || 'CodeGenAgent';
}

/**
 * 所要時間見積もり (分)
 */
const TASK_ESTIMATES = {
  feature: { base: 60, multipliers: { large: 2, quick: 0.5 } },
  bug: { base: 30, multipliers: { major: 2, minor: 0.5 } },
  refactor: { base: 45, multipliers: { complex: 2 } },
  docs: { base: 20, multipliers: {} },
  test: { base: 30, multipliers: {} },
  deployment: { base: 15, multipliers: {} },
  security: { base: 45, multipliers: { critical: 2 } },
};

function estimateTaskDuration(taskType, taskDescription) {
  const estimate = TASK_ESTIMATES[taskType] || TASK_ESTIMATES.feature;
  let duration = estimate.base;
  const desc = taskDescription.toLowerCase();
  for (const [modifier, multiplier] of Object.entries(estimate.multipliers)) {
    if (desc.includes(modifier)) {
      duration *= multiplier;
    }
  }
  return duration;
}

// ============================================================================
// ツール定義
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'ccagi__init',
        description: '新しいCCAGIプロジェクトを作成します。GitHub連携、Agent設定、Claude Code統合を含む完全なセットアップを実行します。',
        inputSchema: {
          type: 'object',
          properties: {
            projectName: {
              type: 'string',
              description: 'プロジェクト名（英数字、ハイフン、アンダースコアのみ）',
            },
            private: {
              type: 'boolean',
              description: 'プライベートリポジトリとして作成するか',
              default: false,
            },
          },
          required: ['projectName'],
        },
      },
      {
        name: 'ccagi__install',
        description: '既存プロジェクトにCCAGIをインストールします。.claude/、GitHub Actions、エージェント定義を追加します。',
        inputSchema: {
          type: 'object',
          properties: {
            dryRun: {
              type: 'boolean',
              description: 'ドライラン（実際には変更しない）',
              default: false,
            },
          },
        },
      },
      {
        name: 'ccagi__status',
        description: 'プロジェクトの状態を確認します。GitHub Issues、Actions、Agent状態を表示します。',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'ccagi__agent_run',
        description: 'Autonomous Agentを実行してGitHub Issueを自動処理します。CoordinatorAgent → CodeGenAgent → ReviewAgent → PRAgentの順で実行されます。',
        inputSchema: {
          type: 'object',
          properties: {
            issueNumber: {
              type: 'number',
              description: '処理するIssue番号',
            },
            agentName: {
              type: 'string',
              description: '実行するAgent名（coordinator, codegen, review, pr, test, security）',
              default: 'coordinator',
            },
            concurrency: {
              type: 'number',
              description: '並行実行数',
              default: 2,
            },
            dryRun: {
              type: 'boolean',
              description: 'ドライラン（実際には変更しない）',
              default: false,
            },
          },
        },
      },
      {
        name: 'ccagi__agent_coordinate',
        description: 'CoordinatorAgentを使用してIssueを完全自動処理します。Issue取得→タスク分解→DAG構築→Agent割り当て→実行→PR作成まで一貫して実行。',
        inputSchema: {
          type: 'object',
          properties: {
            issueNumber: {
              type: 'number',
              description: '処理するIssue番号',
            },
            maxConcurrency: {
              type: 'number',
              description: '最大並行数',
              default: 5,
            },
            qualityThreshold: {
              type: 'number',
              description: '品質スコア閾値（0-100）',
              default: 80,
            },
          },
          required: ['issueNumber'],
        },
      },
      {
        name: 'ccagi__auto',
        description: '全自動モードを起動します。GitHub Issueを自動的に検出・処理し続けます。',
        inputSchema: {
          type: 'object',
          properties: {
            maxIssues: {
              type: 'number',
              description: '最大処理Issue数',
              default: 5,
            },
            interval: {
              type: 'number',
              description: 'ポーリング間隔（秒）',
              default: 60,
            },
          },
        },
      },
      {
        name: 'ccagi__todos',
        description: 'コード内のTODOコメントを自動検出してGitHub Issueを作成します。',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'スキャン対象パス',
              default: './src',
            },
            autoCreate: {
              type: 'boolean',
              description: '自動的にIssue作成するか',
              default: false,
            },
          },
        },
      },
      {
        name: 'ccagi__config',
        description: 'CCAGI設定を表示・編集します。',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['get', 'set', 'list'],
              description: 'アクション（get/set/list）',
              default: 'list',
            },
            key: {
              type: 'string',
              description: '設定キー',
            },
            value: {
              type: 'string',
              description: '設定値',
            },
          },
        },
      },
      {
        name: 'ccagi__get_status',
        description: '現在のプロジェクトのCCAGI/Claude Code統合状態を取得します（軽量・高速）',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'ccagi__fetch_issue',
        description: 'GitHub Issueを取得し、タスク分解・分析を行います',
        inputSchema: {
          type: 'object',
          properties: {
            issueNumber: {
              type: 'number',
              description: 'Issue番号',
            },
          },
          required: ['issueNumber'],
        },
      },
      {
        name: 'ccagi__add_issue_comment',
        description: 'GitHub Issueにコメントを追加します',
        inputSchema: {
          type: 'object',
          properties: {
            issueNumber: {
              type: 'number',
              description: 'Issue番号',
            },
            body: {
              type: 'string',
              description: 'コメント本文（Markdown対応）',
            },
          },
          required: ['issueNumber', 'body'],
        },
      },
    ],
  };
});

// ============================================================================
// ツール実行ハンドラー
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'ccagi__init': {
        const { projectName, private: isPrivate } = args;
        const flags = isPrivate ? '--private' : '';
        const result = executeCCAGICommand(`init ${projectName} ${flags}`);

        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `✅ プロジェクト "${projectName}" を作成しました\n\n${result.output}`
                : `❌ プロジェクト作成に失敗しました\n\nエラー: ${result.error}\n\n${result.stderr}`,
            },
          ],
        };
      }

      case 'ccagi__install': {
        const { dryRun } = args;
        const flags = dryRun ? '--dry-run' : '';
        const result = executeCCAGICommand(`install ${flags}`);

        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `✅ CCAGIをインストールしました\n\n${result.output}`
                : `❌ インストールに失敗しました\n\nエラー: ${result.error}\n\n${result.stderr}`,
            },
          ],
        };
      }

      case 'ccagi__status': {
        const result = executeCCAGICommand('status');
        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `📊 プロジェクトステータス\n\n${result.output}`
                : `❌ ステータス取得に失敗しました\n\n${result.error}`,
            },
          ],
        };
      }

      case 'ccagi__agent_run': {
        const { issueNumber, agentName = 'coordinator', concurrency, dryRun } = args;
        let command = `agent run ${agentName}`;
        if (issueNumber) command += ` --issue ${issueNumber}`;
        if (concurrency) command += ` --concurrency ${concurrency}`;
        if (dryRun) command += ' --dry-run';

        const result = executeCCAGICommand(command, { timeout: 300000 }); // 5分

        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `🤖 Agent実行完了\n\n${result.output}`
                : `❌ Agent実行に失敗しました\n\nエラー: ${result.error}\n\n${result.stderr}\n\n${result.stdout}`,
            },
          ],
        };
      }

      case 'ccagi__agent_coordinate': {
        const { issueNumber, maxConcurrency = 5, qualityThreshold = 80 } = args;

        // 1. Issue取得
        const issueResult = fetchGitHubIssue(issueNumber);
        if (!issueResult.success) {
          return {
            content: [{ type: 'text', text: `❌ Issue取得失敗: ${issueResult.error}` }],
            isError: true,
          };
        }

        const issue = issueResult.issue;

        // 2. タスク分解
        const tasks = extractTasksFromIssue(issue.body || '');

        // タスクがない場合はIssue全体を1タスクとして扱う
        if (tasks.length === 0) {
          tasks.push({
            id: 'task-1',
            description: issue.title,
            dependencies: [],
          });
        }

        // 3. タスク詳細情報を追加
        const enrichedTasks = tasks.map(task => {
          const taskType = determineTaskType(task.description);
          return {
            ...task,
            type: taskType,
            severity: determineSeverity(task.description),
            estimatedDuration: estimateTaskDuration(taskType, task.description),
            agent: assignAgent(taskType),
          };
        });

        // 4. 実行計画を構築
        const executionPlan = {
          issueNumber,
          issueTitle: issue.title,
          totalTasks: enrichedTasks.length,
          maxConcurrency,
          qualityThreshold,
          tasks: enrichedTasks,
          estimatedTotalDuration: enrichedTasks.reduce((sum, t) => sum + t.estimatedDuration, 0),
        };

        // 5. Issueにコメント追加
        const analysisComment = `## 🤖 CoordinatorAgent Analysis

**Issue**: #${issueNumber}
**Tasks Found**: ${enrichedTasks.length}
**Estimated Duration**: ${executionPlan.estimatedTotalDuration} minutes
**Max Concurrency**: ${maxConcurrency}

### Task Breakdown

| # | Task | Type | Agent | Duration |
|---|------|------|-------|----------|
${enrichedTasks.map((t, i) => `| ${i + 1} | ${t.description.substring(0, 40)}... | ${t.type} | ${t.agent} | ${t.estimatedDuration}m |`).join('\n')}

### Execution Plan

\`\`\`json
${JSON.stringify(executionPlan, null, 2)}
\`\`\`

---
🤖 Generated by CCAGI CoordinatorAgent`;

        addIssueComment(issueNumber, analysisComment);

        // 6. レポート保存
        const reportDir = join(PROJECT_ROOT, '.ai', 'parallel-reports');
        if (!existsSync(reportDir)) {
          mkdirSync(reportDir, { recursive: true });
        }
        const reportPath = join(reportDir, `coordination-${issueNumber}-${Date.now()}.json`);
        writeFileSync(reportPath, JSON.stringify(executionPlan, null, 2));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'coordinated',
                issueNumber,
                issueTitle: issue.title,
                tasksFound: enrichedTasks.length,
                estimatedDuration: `${executionPlan.estimatedTotalDuration} minutes`,
                reportPath,
                executionPlan,
              }, null, 2),
            },
          ],
        };
      }

      case 'ccagi__auto': {
        const { maxIssues, interval } = args;
        let command = 'auto';
        if (maxIssues) command += ` --max-issues ${maxIssues}`;
        if (interval) command += ` --interval ${interval}`;

        const result = executeCCAGICommand(command);

        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `🕷️ 全自動モード起動\n\n${result.output}`
                : `❌ 自動モード起動に失敗しました\n\n${result.error}`,
            },
          ],
        };
      }

      case 'ccagi__todos': {
        const { path: scanPath, autoCreate } = args;
        let command = 'todos';
        if (scanPath) command += ` --path ${scanPath}`;
        if (autoCreate) command += ' --auto-create';

        const result = executeCCAGICommand(command);

        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `📝 TODOスキャン完了\n\n${result.output}`
                : `❌ TODOスキャンに失敗しました\n\n${result.error}`,
            },
          ],
        };
      }

      case 'ccagi__config': {
        const { action, key, value } = args;
        let command = 'config';
        if (action === 'get' && key) {
          command += ` --get ${key}`;
        } else if (action === 'set' && key && value) {
          command += ` --set ${key}=${value}`;
        }

        const result = executeCCAGICommand(command);

        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `⚙️ 設定\n\n${result.output}`
                : `❌ 設定操作に失敗しました\n\n${result.error}`,
            },
          ],
        };
      }

      case 'ccagi__get_status': {
        const status = getProjectStatus();

        let statusText = '📊 CCAGI プロジェクト状態\n\n';
        statusText += `作業ディレクトリ: ${status.workingDirectory}\n\n`;
        statusText += `CCAGI統合: ${status.hasCCAGI ? '✅ あり (.ccagi.yml)' : '❌ なし'}\n`;
        statusText += `Claude Code統合: ${status.hasClaude ? '✅ あり (.claude/)' : '❌ なし'}\n`;
        statusText += `GitHub Actions: ${status.hasWorkflows ? '✅ あり' : '❌ なし'}\n`;
        statusText += `エージェント定義: ${status.agentCount}個\n\n`;

        if (status.packageInfo) {
          statusText += `パッケージ: ${status.packageInfo.name}@${status.packageInfo.version}\n`;
          statusText += `依存関係: ${status.packageInfo.dependencies}個\n`;
          statusText += `開発依存: ${status.packageInfo.devDependencies}個\n`;
        } else {
          statusText += 'package.json: なし\n';
        }

        return {
          content: [{ type: 'text', text: statusText }],
        };
      }

      case 'ccagi__fetch_issue': {
        const { issueNumber } = args;
        const result = fetchGitHubIssue(issueNumber);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `❌ Issue取得失敗: ${result.error}` }],
            isError: true,
          };
        }

        const issue = result.issue;
        const tasks = extractTasksFromIssue(issue.body || '');

        // タスク詳細情報を追加
        const enrichedTasks = tasks.map(task => {
          const taskType = determineTaskType(task.description);
          return {
            ...task,
            type: taskType,
            severity: determineSeverity(task.description),
            estimatedDuration: estimateTaskDuration(taskType, task.description),
            agent: assignAgent(taskType),
          };
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                issue: {
                  number: issue.number,
                  title: issue.title,
                  state: issue.state,
                  labels: issue.labels?.map(l => l.name) || [],
                },
                analysis: {
                  tasksFound: enrichedTasks.length,
                  tasks: enrichedTasks,
                  totalEstimatedDuration: enrichedTasks.reduce((sum, t) => sum + t.estimatedDuration, 0),
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'ccagi__add_issue_comment': {
        const { issueNumber, body } = args;
        const result = addIssueComment(issueNumber, body);

        return {
          content: [
            {
              type: 'text',
              text: result.success
                ? `✅ Issue #${issueNumber} にコメントを追加しました`
                : `❌ コメント追加失敗: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ エラーが発生しました\n\n${error.message}\n\n${error.stack}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// サーバー起動
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CCAGI Integration MCP Server running on stdio (v2.0.0)');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
