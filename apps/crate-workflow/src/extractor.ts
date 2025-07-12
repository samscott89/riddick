import { inflate } from 'pako'

interface TarHeader {
  name: string
  mode: string
  uid: string
  gid: string
  size: number
  mtime: string
  checksum: string
  typeflag: string
  linkname: string
  magic: string
  version: string
  uname: string
  gname: string
  devmajor: string
  devminor: string
  prefix: string
}

export class TarExtractor {
  static async extractRustFiles(
    tarGzData: Uint8Array,
  ): Promise<Array<{ path: string; content: string }>> {
    // First decompress the gzip
    const tarData = inflate(tarGzData)

    // Then extract tar entries
    const files: Array<{ path: string; content: string }> = []
    let offset = 0

    while (offset < tarData.length) {
      const header = this.parseTarHeader(tarData, offset)

      if (!header.name) {
        // End of archive
        break
      }

      offset += 512 // Header is always 512 bytes

      if (header.typeflag === '0' || header.typeflag === '') {
        // Regular file
        const filePath = header.name

        // Only process .rs files
        if (filePath.endsWith('.rs')) {
          const fileData = tarData.slice(offset, offset + header.size)
          const content = new TextDecoder().decode(fileData)

          files.push({
            path: filePath,
            content,
          })
        }
      }

      // Move to next entry (files are padded to 512 byte boundaries)
      const paddedSize = Math.ceil(header.size / 512) * 512
      offset += paddedSize
    }

    return files
  }

  private static parseTarHeader(data: Uint8Array, offset: number): TarHeader {
    const headerData = data.slice(offset, offset + 512)

    const readString = (start: number, length: number): string => {
      const bytes = headerData.slice(start, start + length)
      const nullIndex = bytes.indexOf(0)
      const endIndex = nullIndex === -1 ? length : nullIndex
      return new TextDecoder().decode(bytes.slice(0, endIndex))
    }

    const readOctal = (start: number, length: number): number => {
      const str = readString(start, length).replace(/\0.*/, '').trim()
      return str ? parseInt(str, 8) : 0
    }

    return {
      name: readString(0, 100),
      mode: readString(100, 8),
      uid: readString(108, 8),
      gid: readString(116, 8),
      size: readOctal(124, 12),
      mtime: readString(136, 12),
      checksum: readString(148, 8),
      typeflag: readString(156, 1),
      linkname: readString(157, 100),
      magic: readString(257, 6),
      version: readString(263, 2),
      uname: readString(265, 32),
      gname: readString(297, 32),
      devmajor: readString(329, 8),
      devminor: readString(337, 8),
      prefix: readString(345, 155),
    }
  }
}
