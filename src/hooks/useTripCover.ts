import { useEffect, useState } from 'react';
import { resolveTripCoverUrl } from '../core/coverImageStore';

export const useTripCover = (coverImage?: string): string | null => {
  const [src, setSrc] = useState<string | null>(() => coverImage?.trim() || null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setSrc(coverImage?.trim() || null);
    if (!coverImage?.startsWith('idb:')) return () => { active = false; };
    resolveTripCoverUrl(coverImage).then((resolved) => {
      if (!active) return;
      objectUrl = resolved?.startsWith('blob:') ? resolved : null;
      setSrc(resolved);
    }).catch(() => { if (active) setSrc(null); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [coverImage]);

  return src;
};
