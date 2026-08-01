import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { ArrowRightIcon } from '@/icons';
import { safeDecodeURIComponent } from '@/lib/helpers/decode-uri';
import { cn } from '@/lib/utils';
import type { BlogPost } from '@/types/blog';

interface BlogCardProps {
  post: BlogPost;
  index: number;
  /** Required: an optional prop with a literal default silently shipped English
   *  `Read more` on every locale whenever a call site forgot to pass it. */
  readMoreLabel: string;
}

export function BlogCard({ post, index, readMoreLabel }: BlogCardProps) {
  return (
    <LocalizedClientLink
      href={post.href}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-white-84)] p-2 shadow-[0_16px_40px_rgba(90,67,28,0.08)] transition-transform duration-300 hover:-translate-y-1',
        index > 2 && 'hidden xl:flex'
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--bb-radius-panel)]">
        <Image
          loading="lazy"
          sizes="(min-width: 1024px) 33vw, 100vw"
          src={safeDecodeURIComponent(post.image)}
          alt={post.title}
          width={467}
          height={472}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4 text-primary">
        <div className="bb-pill w-fit">{post.category}</div>
        <h3 className="heading-sm">{post.title}</h3>
        <p className="text-md line-clamp-3 text-secondary">{post.excerpt}</p>
        <div className="label-md mt-auto flex items-center gap-4 uppercase text-[var(--cta-hover)]">
          {readMoreLabel}{' '}
          <ArrowRightIcon
            size={20}
            color="rgba(var(--content-primary))"
          />
        </div>
      </div>
    </LocalizedClientLink>
  );
}
