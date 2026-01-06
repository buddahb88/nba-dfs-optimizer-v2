import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nba-dfs/database';
import { z } from 'zod';
import {
  ChatService,
  PlaceholderProvider,
  type ChatMessage,
} from '../services/index.js';

// Initialize chat service with placeholder provider
// Replace PlaceholderProvider with actual AI provider (Azure OpenAI, Anthropic, etc.)
const chatService = new ChatService(prisma, {
  provider: new PlaceholderProvider(),
  maxIterations: 5,
  temperature: 0.7,
});

const createSessionSchema = z.object({
  name: z.string().optional(),
  slateId: z.string().optional(),
});

const sendMessageSchema = z.object({
  sessionId: z.string(),
  content: z.string(),
});

export const chatRoutes: FastifyPluginAsync = async (app) => {
  // Create new chat session
  app.post(
    '/sessions',
    {
      schema: {
        tags: ['Chat'],
        description: 'Create a new chat session',
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            slateId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = createSessionSchema.parse(request.body || {});

      const session = await prisma.chatSession.create({
        data: {
          name: body.name || `Session ${new Date().toLocaleDateString()}`,
          slateId: body.slateId,
        },
      });

      reply.status(201);
      return {
        success: true,
        data: session,
      };
    }
  );

  // Get all chat sessions
  app.get(
    '/sessions',
    {
      schema: {
        tags: ['Chat'],
        description: 'Get all chat sessions',
        querystring: {
          type: 'object',
          properties: {
            slateId: { type: 'string' },
            limit: { type: 'integer', default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const { slateId, limit } = request.query as {
        slateId?: string;
        limit?: number;
      };

      const sessions = await prisma.chatSession.findMany({
        where: slateId ? { slateId } : undefined,
        orderBy: { updatedAt: 'desc' },
        take: limit || 20,
        include: {
          _count: {
            select: { messages: true },
          },
        },
      });

      type SessionWithCount = typeof sessions[number];
      return {
        success: true,
        data: sessions.map((s: SessionWithCount) => ({
          ...s,
          messageCount: s._count.messages,
        })),
      };
    }
  );

  // Get single session with messages
  app.get(
    '/sessions/:sessionId',
    {
      schema: {
        tags: ['Chat'],
        description: 'Get chat session with messages',
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

      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!session) {
        reply.notFound('Session not found');
        return;
      }

      return {
        success: true,
        data: session,
      };
    }
  );

  // Send message to chat
  app.post(
    '/messages',
    {
      schema: {
        tags: ['Chat'],
        description: 'Send a message to the AI assistant',
        body: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['sessionId', 'content'],
        },
      },
    },
    async (request, reply) => {
      const body = sendMessageSchema.parse(request.body);

      // Get session with slate context
      const session = await prisma.chatSession.findUnique({
        where: { id: body.sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 20, // Last 20 messages for context
          },
        },
      });

      if (!session) {
        reply.notFound('Session not found');
        return;
      }

      // Save user message
      const userMessage = await prisma.chatMessage.create({
        data: {
          sessionId: body.sessionId,
          role: 'user',
          content: body.content,
        },
      });

      // Update session timestamp
      await prisma.chatSession.update({
        where: { id: body.sessionId },
        data: { updatedAt: new Date() },
      });

      // Build conversation history for AI
      type SessionMessage = typeof session.messages[number];
      const conversationHistory: ChatMessage[] = session.messages.map((m: SessionMessage) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
      }));

      // Get AI response using ChatService
      const aiResponse = await chatService.chat(
        body.content,
        conversationHistory,
        session.slateId || undefined
      );

      // Save assistant message
      const assistantMessage = await prisma.chatMessage.create({
        data: {
          sessionId: body.sessionId,
          role: 'assistant',
          content: aiResponse.content,
          toolCalls: aiResponse.toolCalls
            ? JSON.stringify(aiResponse.toolCalls)
            : null,
          metadata: aiResponse.metadata
            ? JSON.stringify({
                ...aiResponse.metadata,
                toolResults: aiResponse.toolResults,
              })
            : null,
        },
      });

      return {
        success: true,
        data: {
          userMessage,
          assistantMessage,
          toolsUsed: aiResponse.toolCalls?.map((tc) => tc.function.name) || [],
        },
      };
    }
  );

  // Delete session
  app.delete(
    '/sessions/:sessionId',
    {
      schema: {
        tags: ['Chat'],
        description: 'Delete a chat session',
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

      await prisma.chatSession.delete({
        where: { id: sessionId },
      });

      return {
        success: true,
        message: 'Session deleted',
      };
    }
  );

  // Get available tools
  app.get(
    '/tools',
    {
      schema: {
        tags: ['Chat'],
        description: 'Get list of available AI tools',
      },
    },
    async (request, reply) => {
      const { DFS_TOOLS } = await import('../services/index.js');

      return {
        success: true,
        data: DFS_TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: Object.keys(tool.parameters.properties),
          required: tool.parameters.required || [],
        })),
      };
    }
  );

  // Execute a tool directly (for testing)
  app.post(
    '/tools/execute',
    {
      schema: {
        tags: ['Chat'],
        description: 'Execute a tool directly (for testing)',
        body: {
          type: 'object',
          properties: {
            toolName: { type: 'string' },
            arguments: { type: 'object' },
          },
          required: ['toolName', 'arguments'],
        },
      },
    },
    async (request, reply) => {
      const { toolName, arguments: args } = request.body as {
        toolName: string;
        arguments: Record<string, unknown>;
      };

      const { ToolExecutor } = await import('../services/index.js');
      const executor = new ToolExecutor(prisma);

      const result = await executor.execute({
        id: `test-${Date.now()}`,
        type: 'function',
        function: {
          name: toolName,
          arguments: JSON.stringify(args),
        },
      });

      return {
        success: !result.isError,
        data: JSON.parse(result.result),
      };
    }
  );
};
