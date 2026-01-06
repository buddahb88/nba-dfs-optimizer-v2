'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { slatesApi } from '@/lib/api';
import { useAppStore } from '@/store';

export default function SlatesPage() {
  const queryClient = useQueryClient();
  const { currentSlateId, setCurrentSlateId } = useAppStore();

  const { data: slatesResponse, isLoading } = useQuery({
    queryKey: ['slates'],
    queryFn: () => slatesApi.getAll({ limit: 50 }),
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => slatesApi.sync(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => slatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slates'] });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading slates...</div>;
  }

  const slates = slatesResponse?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Slates</h1>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
          Create Slate
        </button>
      </div>

      {slates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No slates found. Create one to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {slates.map((slate: any) => (
            <div
              key={slate.id}
              className={`p-4 rounded-lg border ${
                currentSlateId === slate.id ? 'border-primary' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{slate.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {slate.playerCount || 0} players | Status: {slate.status}
                  </p>
                  {slate.startTime && (
                    <p className="text-xs text-muted-foreground">
                      Starts: {new Date(slate.startTime).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentSlateId(slate.id)}
                    className={`px-3 py-1 text-sm rounded-md ${
                      currentSlateId === slate.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {currentSlateId === slate.id ? 'Selected' : 'Select'}
                  </button>
                  <button
                    onClick={() => syncMutation.mutate(slate.id)}
                    disabled={syncMutation.isPending}
                    className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
                  >
                    Sync
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(slate.id)}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/80"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
