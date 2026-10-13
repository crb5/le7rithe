import { useEffect, useState } from 'react';
import { ListingImageUploader } from './listing-image-uploader';
import { ListingImage } from './marketplace-ui';
import { useLanguage } from '@/lib/language';

export function ListingEditPhotos({ initialImages, onChange, onBlocked }: {
  initialImages: string[];
  onChange: (paths: string[]) => void;
  onBlocked: (blocked: boolean) => void;
}) {
  const { t } = useLanguage();
  const [retained, setRetained] = useState(initialImages);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [uploadBlocked, setUploadBlocked] = useState(false);
  useEffect(() => {
    const paths = [...retained, ...uploaded];
    onChange(paths);
    onBlocked(uploadBlocked || paths.length > 8);
  }, [retained, uploaded, uploadBlocked, onChange, onBlocked]);
  return <div className="space-y-3" data-testid="edit-listing-photos">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {retained.map((path) => <div key={path} className="min-w-0">
        <div className="h-24 overflow-hidden rounded-xl"><ListingImage images={[path]} alt={t('listingImages')} /></div>
        <button type="button" onClick={() => setRetained((paths) => paths.filter((item) => item !== path))} className="mt-2 text-xs text-[hsl(var(--destructive))]">{t('delete')}</button>
      </div>)}
    </div>
    <ListingImageUploader onChange={setUploaded} onUploadStateChange={setUploadBlocked} />
    {retained.length + uploaded.length > 8 && <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{t('imageEditLimit')}</p>}
  </div>;
}
