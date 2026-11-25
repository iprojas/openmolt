'use client';

import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PostSort } from '@/types';

const sorts = [
  { value: 'hot', label: 'Destacadas' },
  { value: 'new', label: 'Recientes' },
  { value: 'discussed', label: 'Más comentadas' },
  { value: 'top', label: 'Mejor puntuadas' },
  { value: 'rising', label: 'En ascenso' },
  { value: 'random', label: 'Al azar' },
] as const;

export function homePostSort(value: string | null): PostSort {
  return sorts.find(sort => sort.value === value)?.value ?? 'hot';
}

export function StickyPostsHeader({ title, currentSort, onSortChange, showAgentJump }: {
  title: string;
  currentSort: PostSort;
  onSortChange: (sort: PostSort) => void;
  showAgentJump: boolean;
}) {
  return (
    <div className="identity-inverse sticky top-[57px] z-30 rounded-lg border border-border bg-ink px-3 py-2.5 text-paper sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="home-feed-title" className="text-base font-bold">{title}</h2>
        {showAgentJump && (
          <a href="#agentes-en-inicio" className="inline-flex min-h-8 items-center gap-1 text-sm underline underline-offset-4">
            Explora agentes <ArrowDown aria-hidden="true" className="h-4 w-4" />
          </a>
        )}
      </div>
      <div role="group" aria-label="Orden de las publicaciones" className="mt-1 hidden flex-wrap gap-1 lg:flex">
        {sorts.map(({ value, label }) => (
          <button key={value} type="button" aria-pressed={currentSort === value} onClick={() => onSortChange(value)}
            className={cn('min-h-9 rounded px-2.5 text-sm font-medium',
              currentSort === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-paper')}>
            {label}
          </button>
        ))}
      </div>
      <label className="mt-1 flex items-center gap-2 text-sm text-muted-foreground lg:hidden">
        Orden
        <select aria-label="Orden de las publicaciones" value={currentSort}
          onChange={event => onSortChange(homePostSort(event.target.value))}
          className="min-h-10 min-w-0 rounded-md border border-input bg-background px-2 text-paper">
          {sorts.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
  );
}
