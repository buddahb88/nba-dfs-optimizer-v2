// Agent Routes - Multi-Agent Group Chat API

import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nba-dfs/database';
import { z } from 'zod';
import { GroupChatOrchestrator, type AgentRole } from '../services/ai/agents/index.js';
import { createAIProvider, getProviderStatus } from '../services/ai/providers/index.js';

// Initialize group chat orchestrator
const provider = createAIProvider();
const orchestrator = new GroupChatOrchestrator(prisma);
orchestrator.initialize(provider);

console.log(`Agent orchestrator initialized with provider: ${provider.getName()}`);

const sendMessageSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  slateId: z.string().optional(),
  mode: z.enum(['CASH', 'GPP']).optional(),
  forceAgent: z.enum(['research', 'lineup-builder', 'strategy']).optional(),
});

// Store sessions in memory (in production, use Redis or database)
const sessions = new Map<string, import('../services/ai/agents/index.js').GroupChatSession>();

export const agentRoutes: FastifyPluginAsync = async (app) => {
  // Get available agents
  app.get(
    '/',
    {
      schema: {
        tags: ['Agents'],
        description: 'Get list of available agents and their capabilities',
      },
    },
    async () => {
      const agents = orchestrator.getAvailableAgents();
      const status = getProviderStatus();

      return {
        success: true,
        data: {
          agents,
          provider: {
            name: provider.getName(),
            ...status,
          },
        },
      };
    }
  );

  // Send message to agents
  app.post(
    '/messages',
    {
      schema: {
        tags: ['Agents'],
        description: 'Send a message to the multi-agent system',
        body: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            sessionId: { type: 'string' },
            slateId: { type: 'string' },
            mode: { type: 'string', enum: ['CASH', 'GPP'] },
            forceAgent: { type: 'string', enum: ['research', 'lineup-builder', 'strategy'] },
          },
          required: ['message'],
        },
      },
    },
    async (request, reply) => {
      const body = sendMessageSchema.parse(request.body);

      // Get or create session
      let session = body.sessionId ? sessions.get(body.sessionId) : undefined;

      try {
        let result;

        if (body.forceAgent) {
          // Force specific agent
          result = await orchestrator.chatWithAgent(
            body.forceAgent as AgentRole,
            body.message,
            session,
            body.slateId,
            body.mode
          );

          // Store updated session
          sessions.set(result.session.id, result.session);

          return {
            success: true,
            data: {
              response: result.response,
              agentUsed: body.forceAgent,
              sessionId: result.session.id,
              toolsUsed: result.toolsUsed,
              roundCount: result.session.roundCount,
            },
          };
        }

        // Auto-select agent
        result = await orchestrator.chat(
          body.message,
          session || [],
          body.slateId,
          body.mode
        );

        // Store updated session
        sessions.set(result.session.id, result.session);

        return {
          success: true,
          data: {
            response: result.response,
            agentUsed: result.agentUsed,
            sessionId: result.session.id,
            toolsUsed: result.toolsUsed,
            roundCount: result.session.roundCount,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        reply.status(500);
        return {
          success: false,
          error: errorMessage,
        };
      }
    }
  );

  // Get session history
  app.get(
    '/sessions/:sessionId',
    {
      schema: {
        tags: ['Agents'],
        description: 'Get session history',
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
          },
          required: ['sessionId'],
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      const session = sessions.get(sessionId);
      if (!session) {
        reply.notFound('Session not found');
        return;
      }

      return {
        success: true,
        data: {
          id: session.id,
          messages: session.messages,
          currentAgent: session.currentAgent,
          roundCount: session.roundCount,
          context: {
            slateId: session.context.slateId,
            mode: session.context.mode,
          },
        },
      };
    }
  );

  // List active sessions
  app.get(
    '/sessions',
    {
      schema: {
        tags: ['Agents'],
        description: 'List active sessions',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 20 },
          },
        },
      },
    },
    async (request) => {
      const { limit = 20 } = request.query as { limit?: number };

      const sessionList = Array.from(sessions.entries())
        .slice(0, limit)
        .map(([id, session]) => ({
          id,
          messageCount: session.messages.length,
          currentAgent: session.currentAgent,
          roundCount: session.roundCount,
          slateId: session.context.slateId,
          mode: session.context.mode,
        }));

      return {
        success: true,
        data: sessionList,
        meta: {
          total: sessions.size,
          limit,
        },
      };
    }
  );

  // Delete session
  app.delete(
    '/sessions/:sessionId',
    {
      schema: {
        tags: ['Agents'],
        description: 'Delete a session',
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
          },
          required: ['sessionId'],
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      if (!sessions.has(sessionId)) {
        reply.notFound('Session not found');
        return;
      }

      sessions.delete(sessionId);

      return {
        success: true,
        message: 'Session deleted',
      };
    }
  );

  // Get agent capabilities
  app.get(
    '/:agentRole',
    {
      schema: {
        tags: ['Agents'],
        description: 'Get details for a specific agent',
        params: {
          type: 'object',
          properties: {
            agentRole: { type: 'string', enum: ['research', 'lineup-builder', 'strategy'] },
          },
          required: ['agentRole'],
        },
      },
    },
    async (request, reply) => {
      const { agentRole } = request.params as { agentRole: string };

      const agents = orchestrator.getAvailableAgents();
      const agent = agents.find((a) => a.role === agentRole);

      if (!agent) {
        reply.notFound('Agent not found');
        return;
      }

      return {
        success: true,
        data: agent,
      };
    }
  );
};
