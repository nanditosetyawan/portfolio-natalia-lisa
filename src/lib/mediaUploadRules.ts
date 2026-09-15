export type MediaUploadPurpose = 'library' | 'image'

export interface ValidatedMediaUpload {
  extension: 'webp' | 'gif' | 'pdf'
  mimeType: 'image/webp' | 'image/gif' | 'application/pdf'
  kind: 'image' | 'document'
  maximumBytes: number
}

interface MediaUploadRule extends ValidatedMediaUpload {
  acceptedMimeTypes: readonly string[]
}

const MEBIBYTE = 1024 * 1024

const MEDIA_UPLOAD_RULES: Record<ValidatedMediaUpload['extension'], MediaUploadRule> = {
  webp: {
    extension: 'webp',
    mimeType: 'image/webp',
    kind: 'image',
    maximumBytes: 2 * MEBIBYTE,
    acceptedMimeTypes: ['image/webp']
  },
  gif: {
    extension: 'gif',
    mimeType: 'image/gif',
    kind: 'image',
    maximumBytes: 10 * MEBIBYTE,
    acceptedMimeTypes: ['image/gif']
  },
  pdf: {
    extension: 'pdf',
    mimeType: 'application/pdf',
    kind: 'document',
    maximumBytes: 2 * MEBIBYTE,
    acceptedMimeTypes: ['application/pdf']
  }
}

export const MEDIA_LIBRARY_FILE_ACCEPT = '.webp,.gif,.pdf,image/webp,image/gif,application/pdf'
export const EDITOR_IMAGE_FILE_ACCEPT = '.webp,.gif,image/webp,image/gif'

function extensionFromFileName(name: string): string {
  return name.split('.').pop()?.trim().toLocaleLowerCase() ?? ''
}

function supportedFormats(purpose: MediaUploadPurpose): string {
  return purpose === 'image' ? 'WEBP dan GIF' : 'WEBP, PDF, dan GIF'
}

function limitLabel(bytes: number): string {
  return `${bytes / MEBIBYTE}MB`
}

/**
 * The single product-level validation boundary shared by Manage Media,
 * Editor uploads, and the Media Repository. Storage and persistence remain
 * owned by the repository; this helper only validates the incoming File.
 */
export function validateMediaUploadFile(
  file: File,
  purpose: MediaUploadPurpose = 'library'
): ValidatedMediaUpload {
  const extension = extensionFromFileName(file.name)
  const rule = MEDIA_UPLOAD_RULES[extension as ValidatedMediaUpload['extension']]
  if (!rule || (purpose === 'image' && rule.kind !== 'image')) {
    const displayExtension = extension || 'tanpa ekstensi'
    throw new Error(`Format file .${displayExtension} tidak didukung. Hanya ${supportedFormats(purpose)}.`)
  }
  if (file.type && !rule.acceptedMimeTypes.includes(file.type.toLocaleLowerCase())) {
    throw new Error(`Tipe file "${file.type}" tidak sesuai dengan format .${rule.extension}.`)
  }
  if (file.size > rule.maximumBytes) {
    throw new Error(`File "${file.name}" melebihi batas ${limitLabel(rule.maximumBytes)}.`)
  }
  return {
    extension: rule.extension,
    mimeType: rule.mimeType,
    kind: rule.kind,
    maximumBytes: rule.maximumBytes
  }
}
