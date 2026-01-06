'use client';

import { useState } from 'react';
import type { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: ChatMessage;
}

interface ParsedToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // Parse tool calls if present
  const toolCalls: ParsedToolCall[] = message.toolCalls
    ? JSON.parse(message.toolCalls)
    : [];

  // Parse metadata for tool results
  const metadata = message.metadata ? JSON.parse(message.metadata) : null;
  const toolsUsed: string[] = metadata?.toolsUsed || [];

  const toggleTool = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  return (
    <div
      className={cn(
        'flex',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {/* Message Content */}
        <div className="whitespace-pre-wrap">{message.content}</div>

        {/* Tool Calls Display */}
        {toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium opacity-70">Tools Used:</div>
            {toolCalls.map((tool) => (
              <ToolCallDisplay
                key={tool.id}
                tool={tool}
                expanded={expandedTools.has(tool.id)}
                onToggle={() => toggleTool(tool.id)}
              />
            ))}
          </div>
        )}

        {/* Tools Used Badge (from metadata) */}
        {toolsUsed.length > 0 && toolCalls.length === 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {toolsUsed.map((tool, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs rounded bg-background/50"
              >
                {formatToolName(tool)}
              </span>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={cn(
            'text-xs mt-1',
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function ToolCallDisplay({
  tool,
  expanded,
  onToggle,
}: {
  tool: ParsedToolCall;
  expanded: boolean;
  onToggle: () => void;
}) {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(tool.function.arguments);
  } catch {
    // Invalid JSON, leave empty
  }

  return (
    <div className="rounded bg-background/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-background/70"
      >
        <span className="font-medium">{formatToolName(tool.function.name)}</span>
        <span className="text-xs">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 text-xs">
          <div className="font-mono bg-background/30 rounded p-2 overflow-x-auto">
            <pre>{JSON.stringify(args, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
