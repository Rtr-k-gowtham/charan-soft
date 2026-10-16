// frontend/src/components/ui/BuyerAvatar.tsx
import React, { useMemo } from 'react';
import { getBuyerAvatarDataUri, generateAvatarDataUri, AvatarStyle, AvatarConfig } from '../../lib/avatarService';
import { Buyer } from '../../types';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export interface BuyerAvatarProps {
  buyer?: Partial<Buyer> | {
    id?: number | string;
    code?: string;
    name?: string;
    image_url?: string;
    avatar_url?: string;
    avatar_style?: string;
    avatar_seed?: string;
    avatar_config?: string | Record<string, any>;
    customer_avatar_style?: string;
    customer_avatar_seed?: string;
    customer_avatar_config?: string | Record<string, any>;
    customer_code?: string;
    customer_name?: string;
  } | null;
  imageUrl?: string;
  style?: AvatarStyle;
  seed?: string;
  config?: AvatarConfig;
  size?: AvatarSize;
  shape?: 'circle' | 'rounded';
  className?: string;
  showRing?: boolean;
  alt?: string;
  title?: string;
  onClick?: () => void;
}

const SIZE_MAP: Record<AvatarSize, { box: string; img: string }> = {
  xs: { box: 'w-5 h-5 min-w-5 min-h-5', img: 'w-5 h-5' },
  sm: { box: 'w-7 h-7 min-w-7 min-h-7', img: 'w-7 h-7' },
  md: { box: 'w-9 h-9 min-w-9 min-h-9', img: 'w-9 h-9' },
  lg: { box: 'w-12 h-12 min-w-12 min-h-12', img: 'w-12 h-12' },
  xl: { box: 'w-16 h-16 min-w-16 min-h-16', img: 'w-16 h-16' },
  '2xl': { box: 'w-24 h-24 min-w-24 min-h-24', img: 'w-24 h-24' },
  '3xl': { box: 'w-32 h-32 min-w-32 min-h-32', img: 'w-32 h-32' },
};

export default function BuyerAvatar({
  buyer,
  imageUrl,
  style,
  seed,
  config,
  size = 'md',
  shape = 'circle',
  className = '',
  showRing = true,
  alt,
  title,
  onClick,
}: BuyerAvatarProps) {
  const [imgError, setImgError] = React.useState(false);

  const customImg = (imageUrl || (buyer as any)?.image_url || (buyer as any)?.avatar_url || '').trim();

  // Reset imgError if the custom image source changes
  React.useEffect(() => {
    setImgError(false);
  }, [customImg]);

  const dataUri = useMemo(() => {
    if (customImg && !imgError) {
      return customImg;
    }
    if (style && seed) {
      return generateAvatarDataUri(style, seed, config);
    }
    return getBuyerAvatarDataUri(buyer);
  }, [buyer, style, seed, config, customImg, imgError]);

  const buyerName = buyer?.name || (buyer as any)?.customer_name || 'Buyer';
  const label = alt || title || buyerName;

  const shapeClasses = shape === 'circle' ? 'rounded-full' : 'rounded-xl';
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;
  const ringClasses = showRing ? 'ring-1 ring-slate-200 shadow-2xs' : '';
  const interactiveClasses = onClick ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : '';

  return (
    <div
      onClick={onClick}
      title={title || label}
      className={`inline-flex items-center justify-center overflow-hidden bg-slate-100 flex-shrink-0 select-none ${shapeClasses} ${sizeClasses.box} ${ringClasses} ${interactiveClasses} ${className}`}
    >
      <img
        src={dataUri}
        alt={label}
        className={`${shapeClasses} ${sizeClasses.img} object-cover w-full h-full pointer-events-none`}
        loading="lazy"
        onError={() => {
          if (customImg && !imgError) {
            setImgError(true);
          }
        }}
      />
    </div>
  );
}
