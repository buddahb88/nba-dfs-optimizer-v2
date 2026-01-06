'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';
import { MessageBubble } from './MessageBubble';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInterface({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = 'Ask about players, lineups, or strategy...',
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const content = input.trim();
    setInput('');
    await onSendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const quickQuestions = [
    'Who are the best value plays today?',
    'Build me a GPP lineup',
    'Which games have the highest totals?',
    'Find usage bump candidates',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">NBA DFS Assistant</h3>
            <p className="text-muted-foreground mb-6">
              Ask me about player projections, lineup optimization, matchup analysis, or DFS strategy.
            </p>

            <div className="flex flex-wrap justify-center gap-2">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="px-3 py-2 text-sm bg-muted rounded-lg hover:bg-muted/80"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-200" />
            </div>
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className="flex-1 px-4 py-2 border rounded-lg resize-none bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
