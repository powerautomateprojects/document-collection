import type { AttachmentReference } from '../types'

export function parseAttachmentValue(value: string | null | undefined): AttachmentReference[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.flatMap(item => {
      if (!item || typeof item !== 'object') {
        return []
      }

      const attachment = item as Partial<AttachmentReference>
      if (
        typeof attachment.attachmentId !== 'number' ||
        typeof attachment.fileName !== 'string' ||
        typeof attachment.mimeType !== 'string' ||
        typeof attachment.sizeBytes !== 'number' ||
        typeof attachment.downloadUrl !== 'string'
      ) {
        return []
      }

      return [{
        attachmentId: attachment.attachmentId,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        downloadUrl: attachment.downloadUrl,
        webViewUrl: typeof attachment.webViewUrl === 'string' ? attachment.webViewUrl : null,
        uploadToken: typeof attachment.uploadToken === 'string' ? attachment.uploadToken : null,
      }]
    })
  } catch {
    return []
  }
}

export function stringifyAttachmentValue(attachments: AttachmentReference[]): string {
  return JSON.stringify(attachments)
}

export function isLegacyAttachmentValue(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }

  return parseAttachmentValue(value).length === 0
}