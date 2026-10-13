import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Upload, X } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { ViewportImage } from '@/components/viewport-image';

const MAX_IMAGES = 8;
const MAX_FILE_BYTES = 8_000_000;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type ListingImage = {
  id: string;
  name: string;
  previewUrl: string;
  objectPath?: string;
  status: 'uploading' | 'uploaded' | 'error';
  error?: string;
};

type ListingImageUploaderProps = {
  onChange: (objectPaths: string[]) => void;
  onUploadStateChange: (blocked: boolean) => void;
};

export async function uploadImage(file: File, name: string, messages: { storageUnavailable: string; genericError: string }, getToken: () => Promise<string | null>) {
  const token = await getToken();
  const response = await fetch('/api/listing-image/uploads/request-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name, size: file.size, contentType: file.type }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.uploadURL !== 'string' || typeof body.objectPath !== 'string') {
    throw new Error(response.status === 503 ? messages.storageUnavailable : messages.genericError);
  }
  const uploadResponse = await fetch(body.uploadURL, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploadResponse.ok) throw new Error(messages.genericError);
  const processToken = await getToken();
  const processedResponse = await fetch('/api/listing-image/uploads/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(processToken ? { Authorization: `Bearer ${processToken}` } : {}),
    },
    body: JSON.stringify({ objectPath: body.objectPath }),
  });
  const processed = await processedResponse.json().catch(() => ({}));
  if (!processedResponse.ok || typeof processed.objectPath !== 'string') {
    throw new Error(processedResponse.status === 503 ? messages.storageUnavailable : messages.genericError);
  }
  return processed.objectPath as string;
}

export function ListingImageUploader({ onChange, onUploadStateChange }: ListingImageUploaderProps) {
  const { t, formatNumber } = useLanguage();
  const { getToken } = useAuth();
  const [images, setImages] = useState<ListingImage[]>([]);

  useEffect(() => {
    onChange(images.filter((image) => image.status === 'uploaded' && image.objectPath).map((image) => image.objectPath as string));
    onUploadStateChange(images.some((image) => image.status !== 'uploaded'));
  }, [images, onChange, onUploadStateChange]);

  const updateImage = (id: string, update: Partial<ListingImage>) => {
    setImages((current) => current.map((image) => image.id === id ? { ...image, ...update } : image));
  };

  const processImage = async (source: File, id: string) => {
    try {
      // One authoritative server encode avoids cumulative loss from double WebP compression.
      if (source.size > MAX_FILE_BYTES) throw new Error(t('imageUploadTooLarge'));
      const objectPath = await uploadImage(source, source.name, {
        storageUnavailable: t('imageUploadStorageUnavailable'),
        genericError: t('imageUploadError'),
      }, getToken);
      updateImage(id, { objectPath, status: 'uploaded' });
    } catch (error) {
      updateImage(id, { status: 'error', error: error instanceof Error ? error.message : t('imageUploadError') });
    }
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const remaining = MAX_IMAGES - images.length;
    const selected = Array.from(fileList).slice(0, remaining);
    const nextImages: ListingImage[] = [];
    for (const file of selected) {
      if (!ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) {
        nextImages.push({
          id: crypto.randomUUID(),
          name: file.name,
          previewUrl: '',
          status: 'error',
          error: !ACCEPTED_TYPES.has(file.type) ? t('imageUploadInvalidType') : t('imageUploadTooLarge'),
        });
        continue;
      }
      nextImages.push({
        id: crypto.randomUUID(),
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        status: 'uploading',
      });
    }
    if (nextImages.length === 0) return;
    setImages((current) => [...current, ...nextImages].slice(0, MAX_IMAGES));
    selected.forEach((file, index) => {
      const item = nextImages[index];
      if (item?.status === 'uploading') void processImage(file, item.id);
    });
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const image = current.find((item) => item.id === id);
      if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return <div className="field-label mt-4">
    <div className="flex items-center justify-between gap-3">
      <span>{t('listingImages')}</span>
       <span className="font-normal text-[10px] text-[hsl(var(--muted-foreground))]">{formatNumber(images.length)}/{formatNumber(MAX_IMAGES)}</span>
    </div>
    <p className="mt-1 text-[11px] font-normal text-[hsl(var(--muted-foreground))]">{t('listingImagesDescription')}</p>
    <label className="mt-3 flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[hsl(var(--primary)/.35)] bg-[hsl(var(--secondary)/.35)] px-4 py-5 text-xs font-bold text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--secondary))]">
      <ImagePlus size={19} />
      <span>{t('addImages')}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { handleFiles(event.target.files); event.currentTarget.value = ''; }} className="sr-only" data-testid="input-listing-images" />
    </label>
    {images.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {images.map((image, index) => <div key={image.id} className={`relative overflow-hidden rounded-2xl border ${index === 0 ? 'border-[hsl(var(--accent))] ring-2 ring-[hsl(var(--accent)/.3)]' : 'border-[hsl(var(--border))]'} bg-[hsl(var(--secondary)/.3)]`}>
        <div className="aspect-square">
          {image.previewUrl ? <ViewportImage src={image.previewUrl} alt={image.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-3 text-center text-[10px] text-[hsl(var(--destructive))]">{image.error}</div>}
        </div>
        {index === 0 && <span className="absolute left-2 top-2 rounded-lg bg-[hsl(var(--accent))] px-2 py-1 text-[9px] font-bold text-[hsl(var(--primary))]">{t('mainImage')}</span>}
        <div className="absolute right-2 top-2 flex gap-1">
          <button type="button" onClick={() => removeImage(image.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white" aria-label={t('removeImage')}><X size={14} /></button>
        </div>
        {image.status === 'uploading' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-white"><LoaderCircle size={22} className="animate-spin" /><span className="text-[10px]">{t('uploadingImage')}</span></div>}
        {image.status === 'error' && <div className="absolute inset-x-0 bottom-0 bg-[hsl(var(--destructive)/.9)] px-2 py-1 text-[9px] text-white">{image.error}</div>}
        <div className="flex items-center justify-between border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1">
          <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} className="rounded p-1 text-[hsl(var(--primary))] disabled:opacity-25" aria-label={t('moveImageUp')}><ArrowUp size={14} /></button>
           <span className="max-w-20 truncate text-[9px] text-[hsl(var(--muted-foreground))]">{formatNumber(index + 1)}</span>
          <button type="button" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} className="rounded p-1 text-[hsl(var(--primary))] disabled:opacity-25" aria-label={t('moveImageDown')}><ArrowDown size={14} /></button>
        </div>
      </div>)}
    </div>}
    <div className="mt-2 flex items-center gap-2 text-[10px] font-normal text-[hsl(var(--muted-foreground))]"><Upload size={13} />{t('imageUploadRules')}</div>
  </div>;
}