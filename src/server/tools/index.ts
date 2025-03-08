import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { MemoryBankManager } from '../../core/MemoryBankManager.js';
import { ProgressTracker } from '../../core/ProgressTracker.js';

// Import tools and handlers
import { coreTools, handleSetMemoryBankPath, handleInitializeMemoryBank, handleReadMemoryBankFile, handleWriteMemoryBankFile, handleListMemoryBankFiles, handleGetMemoryBankStatus } from './CoreTools.js';
import { progressTools, handleTrackProgress } from './ProgressTools.js';
import { contextTools, handleUpdateActiveContext } from './ContextTools.js';
import { decisionTools, handleLogDecision } from './DecisionTools.js';
import { modeTools, handleSwitchMode, handleGetCurrentMode, handleProcessUmbCommand, handleCompleteUmb } from './ModeTools.js';

/**
 * Sets up all tool handlers for the MCP server
 * @param server MCP Server
 * @param memoryBankManager Memory Bank Manager
 * @param getProgressTracker Function to get the ProgressTracker
 */
export function setupToolHandlers(
  server: Server,
  memoryBankManager: MemoryBankManager,
  getProgressTracker: () => ProgressTracker | null
) {
  // Inicializar o gerenciador de modos
  memoryBankManager.initializeModeManager().catch(error => {
    console.error('Erro ao inicializar o gerenciador de modos:', error);
  });

  // Combines all tools
  const allTools = [
    ...coreTools,
    ...progressTools,
    ...contextTools,
    ...decisionTools,
    ...modeTools,
  ];

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  // Register handler for tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Find Memory Bank directory if not found yet
    if (!memoryBankManager.getMemoryBankDir()) {
      const CWD = process.cwd();
      const memoryBankDir = await memoryBankManager.findMemoryBankDir(CWD);
      if (memoryBankDir) {
        memoryBankManager.setMemoryBankDir(memoryBankDir);
      }
    }

    // Check if arguments are valid
    if (
      request.params.name !== 'get_memory_bank_status' &&
      request.params.name !== 'list_memory_bank_files' &&
      request.params.name !== 'get_current_mode' &&
      (!request.params.arguments || typeof request.params.arguments !== 'object')
    ) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments');
    }

    // Process tools
    switch (request.params.name) {
      // Main tools
      case 'set_memory_bank_path': {
        const { path: customPath } = request.params.arguments as { path: string };
        if (!customPath) {
          throw new McpError(ErrorCode.InvalidParams, 'Path not specified');
        }
        return handleSetMemoryBankPath(memoryBankManager, customPath);
      }

      case 'initialize_memory_bank': {
        const { path: dirPath } = request.params.arguments as { path: string };
        if (!dirPath) {
          throw new McpError(ErrorCode.InvalidParams, 'Path not specified');
        }
        return handleInitializeMemoryBank(memoryBankManager, dirPath);
      }

      case 'read_memory_bank_file': {
        if (!memoryBankManager.getMemoryBankDir()) {
          return {
            content: [
              {
                type: 'text',
                text: 'Memory Bank not found. Use initialize_memory_bank to create one.',
              },
            ],
            isError: true,
          };
        }

        const { filename } = request.params.arguments as { filename: string };
        if (!filename) {
          throw new McpError(ErrorCode.InvalidParams, 'Filename not specified');
        }
        return handleReadMemoryBankFile(memoryBankManager, filename);
      }

      case 'write_memory_bank_file': {
        if (!memoryBankManager.getMemoryBankDir()) {
          return {
            content: [
              {
                type: 'text',
                text: 'Memory Bank not found. Use initialize_memory_bank to create one.',
              },
            ],
            isError: true,
          };
        }

        const { filename, content } = request.params.arguments as {
          filename: string;
          content: string;
        };
        if (!filename) {
          throw new McpError(ErrorCode.InvalidParams, 'Filename not specified');
        }
        if (content === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'Content not specified');
        }
        return handleWriteMemoryBankFile(memoryBankManager, filename, content);
      }

      case 'list_memory_bank_files': {
        if (!memoryBankManager.getMemoryBankDir()) {
          return {
            content: [
              {
                type: 'text',
                text: 'Memory Bank not found. Use initialize_memory_bank to create one.',
              },
            ],
            isError: true,
          };
        }
        return handleListMemoryBankFiles(memoryBankManager);
      }

      case 'get_memory_bank_status': {
        if (!memoryBankManager.getMemoryBankDir()) {
          return {
            content: [
              {
                type: 'text',
                text: 'Memory Bank not found. Use initialize_memory_bank to create one.',
              },
            ],
            isError: true,
          };
        }
        return handleGetMemoryBankStatus(memoryBankManager);
      }

      // Progress tools
      case 'track_progress': {
        const progressTracker = getProgressTracker();
        if (!progressTracker) {
          return {
            content: [
              {
                type: 'text',
                text: 'Memory Bank not found. Use initialize_memory_bank to create one.',
              },
            ],
            isError: true,
          };
        }

        const { action, description } = request.params.arguments as {
          action: string;
          description: string;
        };
        if (!action) {
          throw new McpError(ErrorCode.InvalidParams, 'Action not specified');
        }
        if (!description) {
          throw new McpError(ErrorCode.InvalidParams, 'Description not specified');
        }
        return handleTrackProgress(progressTracker, action, description);
      }

      // Context tools
      case 'update_active_context': {
        const progressTracker = getProgressTracker();
        if (!progressTracker) {
          return {
            content: [
              {
                type: 'text',
                text: 'Memory Bank not found. Use initialize_memory_bank to create one.',
              },
            ],
            isError: true,
          };
        }

        const { tasks, issues, nextSteps } = request.params.arguments as {
          tasks?: string[];
          issues?: string[];
          nextSteps?: string[];
        };
        return handleUpdateActiveContext(progressTracker, { tasks, issues, nextSteps });
      }

      // Decision tools
      case 'log_decision': {
        const progressTracker = getProgressTracker();
        if (!progressTracker) {
          return {
            content: [
              {
                type: 'text',
                text: 'Memory Bank not found. Use initialize_memory_bank to create one.',
              },
            ],
            isError: true,
          };
        }

        const { title, context, decision, alternatives, consequences } = request.params.arguments as {
          title: string;
          context: string;
          decision: string;
          alternatives?: string[] | string;
          consequences?: string[] | string;
        };
        if (!title || !context || !decision) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Title, context, and decision are required'
          );
        }
        return handleLogDecision(progressTracker, {
          title,
          context,
          decision,
          alternatives,
          consequences,
        });
      }

      // Mode tools
      case 'switch_mode': {
        const { mode } = request.params.arguments as { mode: string };
        if (!mode) {
          throw new McpError(ErrorCode.InvalidParams, 'Mode not specified');
        }
        return handleSwitchMode(memoryBankManager, mode);
      }

      case 'get_current_mode': {
        return handleGetCurrentMode(memoryBankManager);
      }

      case 'process_umb_command': {
        const { command } = request.params.arguments as { command: string };
        if (!command) {
          throw new McpError(ErrorCode.InvalidParams, 'Command not specified');
        }
        return handleProcessUmbCommand(memoryBankManager, command);
      }

      case 'complete_umb': {
        return handleCompleteUmb(memoryBankManager);
      }

      // Unknown tool
      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${request.params.name}`,
            },
          ],
          isError: true,
        };
    }
  });
}