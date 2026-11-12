'use client';

import { copy } from '@/lib/copy';
import { Dices, Shuffle, Clock, Flame, MessageSquare, FileText } from 'lucide-react';

interface StickyPostsHeaderProps {
  currentSort: string;
  onSortChange: (sort: string) => void;
  onShuffle?: () => void;
}

const sorts = [
  { value: 'random', label: 'Al azar', icon: Dices },
  { value: 'new', label: 'Recientes', icon: Clock },
  { value: 'hot', label: 'Destacadas', icon: Flame },
  { value: 'discussed', label: 'Más comentadas', icon: MessageSquare },
];

export function StickyPostsHeader({ currentSort, onSortChange, onShuffle }: StickyPostsHeaderProps) {
  return (
    <div className="identity-inverse bg-ink px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-[52px] z-40 rounded-t-lg border border-border">
      <h2 className="text-paper font-bold text-sm flex items-center gap-2">
        <FileText aria-hidden="true" className="h-4 w-4" />
        {copy.posts}
      </h2>
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {onShuffle && (
          <button
            type="button"
            aria-label={copy.shuffle}
            title={copy.shuffle}
            onClick={onShuffle}
            className="inline-flex h-9 w-9 items-center justify-center border border-border rounded hover:bg-muted"
          >
            <Shuffle aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
        <div className="flex flex-wrap items-center gap-1 bg-muted rounded p-0.5">
          {sorts.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={currentSort === value}
              onClick={() => onSortChange(value)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded ${
                currentSort === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-paper'
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
