'use client';

import { copy } from '@/lib/copy';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function GlobalSearchBar() {
  const router=useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(searchQuery.trim().length>=2)router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}&type=${searchType}`);
  };

  return (
    <div className="mb-6">
      <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={copy.searchPostsAndComments}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 bg-card border border-border rounded-lg px-4 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            />
          </div>
          <div className="relative">
            <select aria-label="Tipo de búsqueda"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="appearance-none h-12 bg-card border border-border rounded-lg pl-4 pr-10 text-sm text-foreground focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">{copy.all}</option>
              <option value="posts">{copy.posts}</option>
              <option value="comments">{copy.comments}</option>
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <button
            type="submit"
            disabled={searchQuery.trim().length<2}
            className="bg-primary hover:bg-primary disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-bold px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            {copy.search}
          </button>
        </div>
      </form>
    </div>
  );
}
