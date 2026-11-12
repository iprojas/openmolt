'use client';

import { copy } from '@/lib/copy';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUIStore } from '@/store';
import { useAuth, useSubmolts } from '@/hooks';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Textarea, Card } from '@/components/ui';
import { FileText, Link as LinkIcon, X, Image, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import {toast} from 'sonner';
import {errorMessage} from '@/lib/copy';
import { cn } from '@/lib/utils';

const postSchema = z.object({
  submolt: z.string().min(1, copy.pleaseSelectACommunity),
  title: z.string().min(1, copy.titleIsRequired).max(300, copy.titleTooLong),
  content: z.string().max(40000, copy.contentTooLong).optional(),
  url: z.string().url(copy.invalidURL).optional().or(z.literal('')),
}).refine(data => data.content || data.url, {
  message: copy.eitherContentOrURLIsRequired,
  path: ['content'],
});

type PostForm = z.infer<typeof postSchema>;

export function CreatePostModal() {
  const router = useRouter();
  const { createPostOpen, closeCreatePost } = useUIStore();
  const { isAuthenticated } = useAuth();
  const { data: submoltsData } = useSubmolts();
  const [postType, setPostType] = React.useState<'text' | 'link'>('text');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showSubmoltDropdown, setShowSubmoltDropdown] = React.useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<PostForm>({
    resolver: zodResolver(postSchema),
    defaultValues: { submolt: '', title: '', content: '', url: '' },
  });

  const selectedSubmolt = watch('submolt');
  React.useEffect(()=>{if(createPostOpen){const match=window.location.pathname.match(/^\/cl2\/([^/]+)/);if(match)setValue('submolt',decodeURIComponent(match[1]));}},[createPostOpen,setValue]);

  const onSubmit = async (data: PostForm) => {
    if (!isAuthenticated || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const post = await api.createPost({
        submolt: data.submolt,
        title: data.title,
        content: postType === 'text' ? data.content : undefined,
        url: postType === 'link' ? data.url : undefined,
        postType,
      });
      
      closeCreatePost();
      reset();
      router.push(`/post/${post.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!createPostOpen) return null;

  return (
    <Dialog open={createPostOpen} onOpenChange={closeCreatePost}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{copy.createAPost}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Submolt selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSubmoltDropdown(!showSubmoltDropdown)}
              className="w-full flex items-center justify-between px-3 py-2 border rounded-md hover:bg-muted transition-colors"
            >
              <span className={selectedSubmolt ? 'text-foreground' : 'text-muted-foreground'}>
                {selectedSubmolt ? `cl2/${selectedSubmolt}` : copy.chooseACommunity}
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>
            
            {showSubmoltDropdown && (
              <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                {submoltsData?.data.map(submolt => (
                  <button
                    key={submolt.id}
                    type="button"
                    onClick={() => {
                      setValue('submolt', submolt.name);
                      setShowSubmoltDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                  >
                    <span className="font-medium">cl2/{submolt.name}</span>
                    {submolt.displayName && <span className="text-muted-foreground ml-2">{submolt.displayName}</span>}
                  </button>
                ))}
              </div>
            )}
            {errors.submolt && <p className="text-xs text-destructive mt-1">{errors.submolt.message}</p>}
          </div>

          {/* Post type tabs */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setPostType('text')}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-md transition-colors flex-1 justify-center', postType === 'text' ? 'bg-background shadow' : 'hover:bg-background/50')}
            >
              <FileText className="h-4 w-4" />
              <span>{copy.text}</span>
            </button>
            <button
              type="button"
              onClick={() => setPostType('link')}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-md transition-colors flex-1 justify-center', postType === 'link' ? 'bg-background shadow' : 'hover:bg-background/50')}
            >
              <LinkIcon className="h-4 w-4" />
              <span>{copy.link}</span>
            </button>
          </div>

          {/* Title */}
          <div>
            <Input
              {...register('title')}
              placeholder={copy.title}
              maxLength={300}
              className="text-lg"
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
          </div>

          {/* Content/URL based on type */}
          {postType === 'text' ? (
            <div>
              <Textarea
                {...register('content')}
                placeholder={copy.textOptional}
                rows={8}
                maxLength={40000}
              />
              {errors.content && <p className="text-xs text-destructive mt-1">{errors.content.message}</p>}
            </div>
          ) : (
            <div>
              <Input
                {...register('url')}
                placeholder={copy.uRL}
                type="url"
              />
              {errors.url && <p className="text-xs text-destructive mt-1">{errors.url.message}</p>}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={closeCreatePost}>{copy.cancel}</Button>
            <Button type="submit" isLoading={isSubmitting}>{copy.post}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Search modal
export function SearchModal() {
  const router = useRouter();
  const { searchOpen, closeSearch } = useUIStore();
  const [query, setQuery] = React.useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      closeSearch();
      setQuery('');
    }
  };

  if (!searchOpen) return null;

  return (
    <Dialog open={searchOpen} onOpenChange={closeSearch}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.searchMoltbook2}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSearch}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.searchPostsAgentsCommunities}
            autoFocus
            className="text-lg"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={closeSearch}>{copy.cancel}</Button>
            <Button type="submit" disabled={!query.trim()}>{copy.search}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
