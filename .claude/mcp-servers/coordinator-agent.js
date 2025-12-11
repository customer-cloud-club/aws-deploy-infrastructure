#!/usr/bin/env node

/**
 * CoordinatorAgent MCP Server
 *
 * タスク統括・並行実行制御Agent - DAGベースの自律オーケストレーション
 *
 * Features:
 * - Issue → Task分解 (1-3時間単位)
 * - DAG (有向非巡回グラフ) 構築
 * - トポロジカルソート実行
 * - Agent種別の自動判定・割り当て
 * - 並行度算出 (最大5並行)
 * - 進捗モニタリング・レポート生成
 *
 * @see .claude-plugin/agents/coordinator.md
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

/**
 * Task種別判定ルール
 */
const TASK_TYPE_KEYWORDS = {
  feature: ['feature', 'add', 'new', 'implement'],
  bug: ['bug', 'fix', 'error', 'issue'],
  refactor: ['refactor', 'cleanup', 'improve'],
  docs: ['doc', 'documentation', 'readme'],
  test: ['test', 'spec', 'coverage'],
  deployment: ['deploy', 'release', 'publish'],
};

/**
 * Severity判定ルール
 */
const SEVERITY_KEYWORDS = {
  'Sev.1-Critical': ['critical', 'urgent', 'blocking'],
  'Sev.2-High': ['high priority', 'important'],
  'Sev.4-Low': ['minor', 'small'],
  'Sev.5-Trivial': ['nice to have', 'optional'],
};

/**
 * タスク所要時間見積もり (分)
 */
const TASK_ESTIMATES = {
  feature: { base: 60, multipliers: { large: 2, quick: 0.5 } },
  bug: { base: 30, multipliers: { major: 2, minor: 0.5 } },
  refactor: { base: 45, multipliers: { complex: 2 } },
  docs: { base: 20, multipliers: {} },
  test: { base: 30, multipliers: {} },
  deployment: { base: 15, multipliers: {} },
};

/**
 * DAG構築: Kahn's Algorithmによるトポロジカルソート
 */
class TaskDAG {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
  }

  addNode(id, data) {
    this.nodes.set(id, { id, data, dependencies: [] });
  }

  addEdge(from, to) {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`Invalid edge: ${from} -> ${to}`);
    }
    this.edges.push({ from, to });
    this.nodes.get(to).dependencies.push(from);
  }

  /**
   * トポロジカルソート (Kahn's Algorithm)
   * @returns {Array<Array<string>>} レベル別のノードID配列
   */
  topologicalSort() {
    const inDegree = new Map();
    const levels = [];

    // 入次数を計算
    for (const [id] of this.nodes) {
      inDegree.set(id, 0);
    }
    for (const { to } of this.edges) {
      inDegree.set(to, inDegree.get(to) + 1);
    }

    // 入次数0のノードをキューに追加
    let queue = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    // レベル順にソート
    while (queue.length > 0) {
      const currentLevel = [...queue];
      levels.push(currentLevel);
      queue = [];

      for (const nodeId of currentLevel) {
        // このノードから出るエッジを処理
        for (const { from, to } of this.edges) {
          if (from === nodeId) {
            const newDegree = inDegree.get(to) - 1;
            inDegree.set(to, newDegree);
            if (newDegree === 0) {
              queue.push(to);
            }
          }
        }
      }
    }

    // 循環依存チェック
    const processedNodes = levels.flat().length;
    if (processedNodes < this.nodes.size) {
      throw new Error('Circular dependency detected in task graph');
    }

    return levels;
  }

  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      levels: this.topologicalSort(),
    };
  }
}

/**
 * タスク種別を判定
 */
function determineTaskType(taskDescription) {
  const desc = taskDescription.toLowerCase();
  for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    if (keywords.some(keyword => desc.includes(keyword))) {
      return type;
    }
  }
  return 'feature'; // デフォルト
}

/**
 * Severityを判定
 */
function determineSeverity(taskDescription) {
  const desc = taskDescription.toLowerCase();
  for (const [severity, keywords] of Object.entries(SEVERITY_KEYWORDS)) {
    if (keywords.some(keyword => desc.includes(keyword))) {
      return severity;
    }
  }
  return 'Sev.3-Medium'; // デフォルト
}

/**
 * 所要時間を見積もり (分)
 */
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

/**
 * Agent種別を割り当て
 */
function assignAgent(taskType) {
  const agentMapping = {
    feature: 'CodeGenAgent',
    bug: 'CodeGenAgent',
    refactor: 'CodeGenAgent',
    docs: 'CodeGenAgent',
    test: 'CodeGenAgent',
    deployment: 'DeploymentAgent',
  };
  return agentMapping[taskType] || 'CodeGenAgent';
}

/**
 * Issue本文からタスクを抽出
 */
function extractTasksFromIssue(issueBody) {
  const tasks = [];
  const lines = issueBody.split('\n');

  let taskId = 1;
  for (const line of lines) {
    // チェックボックス形式: - [ ] Task description
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

    // 番号付きリスト: 1. Task description
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

    // 見出し形式: ## Task description
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
 * タスクDAGを構築
 */
function buildTaskDAG(tasks) {
  const dag = new TaskDAG();

  // ノードを追加
  for (const task of tasks) {
    const taskType = determineTaskType(task.description);
    const severity = determineSeverity(task.description);
    const durationMinutes = estimateTaskDuration(taskType, task.description);
    const agent = assignAgent(taskType);

    dag.addNode(task.id, {
      description: task.description,
      type: taskType,
      severity,
      estimatedDuration: durationMinutes,
      agent,
    });
  }

  // エッジを追加
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      // Issue番号を探す
      const depTaskId = tasks.find(t => t.description.includes(dep))?.id;
      if (depTaskId) {
        dag.addEdge(depTaskId, task.id);
      }
    }
  }

  return dag;
}

/**
 * 実行レポートを生成
 */
function generateExecutionReport(dagData, sessionId, startTime, endTime, results) {
  const totalTasks = dagData.nodes.length;
  const completed = results.filter(r => r.status === 'completed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const escalated = results.filter(r => r.status === 'escalated').length;

  const report = {
    sessionId,
    deviceIdentifier: 'Claude Code MCP Server',
    startTime,
    endTime,
    totalDurationMs: endTime - startTime,
    summary: {
      total: totalTasks,
      completed,
      failed,
      escalated,
      successRate: ((completed / totalTasks) * 100).toFixed(1),
    },
    tasks: results,
    dag: dagData,
  };

  // レポートファイルを保存
  const reportDir = join(PROJECT_ROOT, '.ai', 'parallel-reports');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = join(reportDir, `execution-report-${sessionId}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  return { report, reportPath };
}

/**
 * MCP Server定義
 */
const server = new Server(
  {
    name: 'coordinator-agent',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * ツール一覧
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'decompose_issue',
        description: 'GitHub Issueをタスクに分解し、依存関係を分析します',
        inputSchema: {
          type: 'object',
          properties: {
            issueNumber: {
              type: 'number',
              description: 'GitHub Issue番号',
            },
            issueBody: {
              type: 'string',
              description: 'Issue本文 (GitHub APIから取得した内容)',
            },
          },
          required: ['issueBody'],
        },
      },
      {
        name: 'build_task_dag',
        description: 'タスクリストからDAG (有向非巡回グラフ) を構築します',
        inputSchema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              description: 'タスクリスト',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  description: { type: 'string' },
                  dependencies: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
          required: ['tasks'],
        },
      },
      {
        name: 'generate_execution_plan',
        description: 'DAGから並行実行計画を生成します',
        inputSchema: {
          type: 'object',
          properties: {
            dagData: {
              type: 'object',
              description: 'DAGデータ (build_task_dagの出力)',
            },
            maxConcurrency: {
              type: 'number',
              description: '最大並行数 (デフォルト: 5)',
              default: 5,
            },
          },
          required: ['dagData'],
        },
      },
      {
        name: 'save_execution_report',
        description: '実行レポートを生成・保存します',
        inputSchema: {
          type: 'object',
          properties: {
            dagData: {
              type: 'object',
              description: 'DAGデータ',
            },
            results: {
              type: 'array',
              description: 'タスク実行結果',
              items: {
                type: 'object',
                properties: {
                  taskId: { type: 'string' },
                  status: { type: 'string', enum: ['completed', 'failed', 'escalated'] },
                  agentType: { type: 'string' },
                  durationMs: { type: 'number' },
                },
              },
            },
          },
          required: ['dagData', 'results'],
        },
      },
    ],
  };
});

/**
 * ツール実行ハンドラー
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'decompose_issue': {
        const { issueNumber, issueBody } = args;
        const tasks = extractTasksFromIssue(issueBody);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                issueNumber,
                tasksFound: tasks.length,
                tasks: tasks.map(t => ({
                  id: t.id,
                  description: t.description,
                  dependencies: t.dependencies,
                  type: determineTaskType(t.description),
                  severity: determineSeverity(t.description),
                  estimatedDuration: estimateTaskDuration(
                    determineTaskType(t.description),
                    t.description
                  ),
                  agent: assignAgent(determineTaskType(t.description)),
                })),
              }, null, 2),
            },
          ],
        };
      }

      case 'build_task_dag': {
        const { tasks } = args;
        const dag = buildTaskDAG(tasks);
        const dagData = dag.toJSON();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                nodes: dagData.nodes.length,
                edges: dagData.edges.length,
                levels: dagData.levels.length,
                maxConcurrency: Math.max(...dagData.levels.map(l => l.length)),
                dag: dagData,
              }, null, 2),
            },
          ],
        };
      }

      case 'generate_execution_plan': {
        const { dagData, maxConcurrency = 5 } = args;

        const executionPlan = {
          totalLevels: dagData.levels.length,
          maxConcurrency,
          estimatedDuration: dagData.nodes.reduce(
            (sum, node) => sum + node.data.estimatedDuration,
            0
          ),
          levels: dagData.levels.map((level, idx) => ({
            levelIndex: idx,
            taskCount: level.length,
            concurrency: Math.min(level.length, maxConcurrency),
            tasks: level.map(nodeId => {
              const node = dagData.nodes.find(n => n.id === nodeId);
              return {
                taskId: node.id,
                description: node.data.description,
                agent: node.data.agent,
                estimatedDuration: node.data.estimatedDuration,
              };
            }),
          })),
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(executionPlan, null, 2),
            },
          ],
        };
      }

      case 'save_execution_report': {
        const { dagData, results } = args;
        const sessionId = `session-${Date.now()}`;
        const startTime = Date.now() - 60000; // 仮の開始時刻
        const endTime = Date.now();

        const { report, reportPath } = generateExecutionReport(
          dagData,
          sessionId,
          startTime,
          endTime,
          results
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Execution report saved',
                reportPath,
                summary: report.summary,
              }, null, 2),
            },
          ],
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
          text: JSON.stringify({
            error: error.message,
            stack: error.stack,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

/**
 * サーバー起動
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('CoordinatorAgent MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
