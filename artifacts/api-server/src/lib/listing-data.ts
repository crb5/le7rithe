import { CreateListingBody, UpdateListingBody } from '@workspace/api-zod';
import type { ListingPhoneFields } from './mauritania-phone';
import { getListingContentEditWindow } from '@workspace/api-zod/listing-edit-window';

type ListingBody = typeof CreateListingBody._output;
type PublishedListingUpdateBody = typeof UpdateListingBody._output;

export function listingContentEditable(createdAt: Date | string, now = Date.now()): boolean {
  return getListingContentEditWindow(createdAt, now).editable;
}

export const listingFromBody = (
  body: ListingBody,
  sellerId: number,
  categoryId: number,
  subcategoryId: number | null,
) => ({
  sellerId,
  contactPhone: body.contactPhone,
  whatsappPhone: body.whatsappPhone ?? null,
  title: body.title,
  categoryId,
  subcategoryId,
  price: String(body.price),
  currency: "MRU",
  location: body.location,
  condition: body.condition,
  year: body.year ?? null,
  manufacturer: body.manufacturer ?? null,
  model: body.model ?? null,
  hours: body.hours ?? null,
  area: body.area == null ? null : String(body.area),
  waterAvailable: body.waterAvailable ?? null,
  electricityAvailable: body.electricityAvailable ?? null,
  ownershipType: body.ownershipType ?? null,
  attributes: body.attributes ?? {},
  description: body.description,
  imageUrl: body.images?.[0] ?? body.imageUrl ?? '',
  images: body.images?.length ? body.images : body.imageUrl ? [body.imageUrl] : [],
});

export const publishedListingUpdateValues = (
  body: PublishedListingUpdateBody,
  phones: ListingPhoneFields,
) => ({
  price: String(body.price),
  currency: "MRU",
  ...(phones.contactPhone === undefined ? {} : { contactPhone: phones.contactPhone }),
  ...(phones.whatsappPhone === undefined ? {} : { whatsappPhone: phones.whatsappPhone }),
  ...(body.description === undefined ? {} : { description: body.description }),
  ...(body.images === undefined ? {} : { images: body.images, imageUrl: body.images[0] ?? '' }),
});