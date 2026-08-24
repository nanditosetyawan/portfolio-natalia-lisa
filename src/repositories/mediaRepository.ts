import { supabaseClient } from '../lib/supabaseClient'

export const PORTFOLIO_MEDIA_BUCKET = 'portfolio-media'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function extensionFor(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension && /^[a-z0-9]+$/.test(extension)) return extension
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function assertImage(file: File): void {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image exceeds the 10 MB limit')
}

export async function uploadPortfolioMedia(input: { file: File; entityType: string; entityId: string; mediaId: string }) {
  assertImage(input.file)
  const path = `portfolio/${input.entityType}/${input.entityId}/${input.mediaId}.${extensionFor(input.file)}`
  const { error } = await supabaseClient.storage.from(PORTFOLIO_MEDIA_BUCKET).upload(path, input.file, { upsert: true, contentType: input.file.type })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data } = supabaseClient.storage.from(PORTFOLIO_MEDIA_BUCKET).getPublicUrl(path)
  return { bucket: PORTFOLIO_MEDIA_BUCKET, path, publicUrl: data.publicUrl, mimeType: input.file.type, fileSize: input.file.size }
}

export async function removePortfolioMedia(path: string): Promise<void> {
  const { error } = await supabaseClient.storage.from(PORTFOLIO_MEDIA_BUCKET).remove([path])
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
}
