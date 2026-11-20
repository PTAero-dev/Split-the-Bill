import { getFriendColor } from '../lib/format';

interface AvatarBadgeProps {
  name: string;
  color: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function AvatarBadge({
  name,
  color,
  avatarUrl,
  size = 'md',
}: AvatarBadgeProps) {
  const palette = getFriendColor(color);
  const initial = (name.trim() || '?').slice(0, 1).toUpperCase();

  const sizeClass =
    size === 'xs'
      ? 'h-5 w-5 text-[10px]'
      : size === 'sm'
        ? 'h-7 w-7 text-xs'
        : size === 'lg'
          ? 'h-12 w-12 text-base'
          : 'h-9 w-9 text-sm';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`shrink-0 rounded-full object-cover ring-2 shadow-xs ${palette.ringClass} ${sizeClass}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-1 ring-white/15 shadow-xs ${palette.bgClass} ${palette.textClass} ${sizeClass}`}
    >
      {initial}
    </span>
  );
}
