import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { ArrowRightIcon } from '@/icons';
import { safeDecodeURIComponent } from '@/lib/helpers/decode-uri';
import { cn } from '@/lib/utils';
import type { BlogPost } from '@/types/blog';

import tailwindConfig from '../../../../tailwind.config';

interface BlogCardProps {
  post: BlogPost;
  index: number;
  readMoreLabel?: string;
}

export function BlogCard({ post, index, readMoreLabel }: BlogCardProps) {
  return (
    <LocalizedClientLink
      href={post.href}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-[rgba(144,112,50,0.14)] bg-[rgba(255,255,255,0.84)] p-2 shadow-[0_16px_40px_rgba(90,67,28,0.08)] transition-transform duration-300 hover:-translate-y-1',
        index > 2 && 'hidden xl:flex'
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[20px]">
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
        <div className="label-md mt-auto flex items-center gap-4 uppercase text-[rgb(113,88,40)]">
          {readMoreLabel ?? 'Read more'}{' '}
          <ArrowRightIcon
            size={20}
            color={tailwindConfig.theme.extend.colors.primary}
          />
        </div>
      </div>
    </LocalizedClientLink>
  );
}
