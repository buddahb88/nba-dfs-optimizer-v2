'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/lib/api';
import { useAppStore } from '@/store';
import { ChatInterface } from '@/components/chat';
import type { ChatMessage } from '@/types';

export default function ChatPage() {
  const queryClient = useQueryClient();
  const { currentChatSessionId, setCurrentChatSessionId, currentSlateId } = useAppStore();
  const [isCreating, setIsCreating] = useState(false);

  const { data: sessionsResponse } = useQuery({
    queryKey: ['chatSessions'],
    queryFn: () => chatApi.getSessions({ limit: 20 }),
  });

  const { data: sessionResponse, isLoading: loadingSession } = useQuery({
    queryKey: ['chatSession', currentChatSessionId],
    queryFn: () => chatApi.getSession(currentChatSessionId!),
    enabled: !!currentChatSessionId,
  });

  const createSessionMutation = useMutation({
    mutationFn: () => chatApi.createSession(currentSlateId ? { slateId: currentSlateId } : undefined),
    onSuccess: (response) => {
      setCurrentChatSessionId(response.data.id);
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
      setIsCreating(false);
    },
    onError: () => {
      setIsCreating(false);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      chatApi.sendMessage(currentChatSessionId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['chatSession', currentChatSessionId],
      });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => chatApi.deleteSession(id),
    onSuccess: () => {
      if (currentChatSessionId) {
        setCurrentChatSessionId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    },
  });

  const handleNewChat = () => {
    setIsCreating(true);
    createSessionMutation.mutate();
  };

  const handleSendMessage = async (content: string) => {
    if (!currentChatSessionId) {
      // Create session first if none exists
      const response = await chatApi.createSession(currentSlateId ? { slateId: currentSlateId } : undefined);
      setCurrentChatSessionId(response.data.id);
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
      await chatApi.sendMessage(response.data.id, content);
      queryClient.invalidateQueries({ queryKey: ['chatSession', response.data.id] });
    } else {
      await sendMessageMutation.mutateAsync(content);
    }
  };

  const sessions = sessionsResponse?.data || [];
  const currentSession = sessionResponse?.data;
  const messages: ChatMessage[] = currentSession?.messages || [];

  return (
    <div className="flex h-[calc(100vh-10rem)]">
      {/* Sessions Sidebar */}
      <div className="w-64 border-r pr-4 flex flex-col">
        <button
          onClick={handleNewChat}
          disabled={isCreating || createSessionMutation.isPending}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : 'New Chat'}
        </button>

        <div className="mt-4 flex-1 overflow-y-auto space-y-2">
          {sessions.map((session: any) => (
            <div
              key={session.id}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                currentChatSessionId === session.id
                  ? 'bg-accent'
                  : 'hover:bg-muted'
              }`}
              onClick={() => setCurrentChatSessionId(session.id)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate flex-1">
                  {session.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSessionMutation.mutate(session.id);
                  }}
                  className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete chat"
                >
                  ×
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {session.messageCount || 0} messages
                </span>
                {session.slateId && (
                  <span className="text-xs px-1.5 py-0.5 bg-primary/10 rounded">
                    Slate
                  </span>
                )}
              </div>
            </div>
          ))}

          {sessions.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No chat sessions yet
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col pl-4">
        {loadingSession ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200" />
            </div>
          </div>
        ) : (
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={sendMessageMutation.isPending}
            placeholder={
              currentSlateId
                ? 'Ask about players, lineups, or strategy for this slate...'
                : 'Ask about players, lineups, or general DFS strategy...'
            }
          />
        )}
      </div>
    </div>
  );
}
