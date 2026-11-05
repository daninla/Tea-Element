import { Inject, Injectable } from '@nestjs/common';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../../../shared/prisma.service';
import { readEnvironment } from '../../../config/environment';
import { CatalogMediaStore, CatalogAdminError } from '../domain/catalog-admin-store';
@Injectable()
export class FileCatalogMediaStore extends CatalogMediaStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async upload(base64: string, actorId: string) {
    const source = Buffer.from(base64, 'base64');
    if (source.length < 12 || source.length > 5242880 || source.toString('base64') !== base64)
      throw new CatalogAdminError('INVALID_INPUT', 'Invalid image encoding or size', 400);
    let bytes: Buffer, width: number, height: number;
    try {
      const image = sharp(source, { limitInputPixels: 36000000, failOn: 'warning' });
      const info = await image.metadata();
      if (!info.format || !['jpeg', 'png', 'webp'].includes(info.format) || (info.pages ?? 1) > 1)
        throw new Error('Unsupported image');
      const out = await image
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      bytes = out.data;
      width = out.info.width;
      height = out.info.height;
      if (bytes.length > 2097152) throw new Error('Output exceeds limit');
    } catch {
      throw new CatalogAdminError(
        'INVALID_INPUT',
        'Use a JPEG, PNG or WebP image up to 5 MB and 36 megapixels',
        400,
      );
    }
    const id = randomUUID(),
      directory = readEnvironment().CATALOG_MEDIA_DIR,
      path = join(directory, id + '.webp');
    await mkdir(directory, { recursive: true });
    await writeFile(path, bytes, { flag: 'wx' });
    try {
      await this.db.mediaAsset.create({
        data: {
          id,
          actorId,
          width,
          height,
          size: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        },
      });
    } catch (e) {
      await unlink(path).catch(() => {});
      throw e;
    }
    return { id, path: `/media/${id}.webp`, width, height };
  }
  async get(id: string) {
    const row = await this.db.mediaAsset.findUnique({ where: { id } });
    if (!row) throw new CatalogAdminError('MEDIA_NOT_FOUND', 'Image not found', 404);
    let bytes: Buffer;
    try {
      bytes = await readFile(join(readEnvironment().CATALOG_MEDIA_DIR, id + '.webp'));
    } catch {
      throw new CatalogAdminError('MEDIA_NOT_FOUND', 'Image not found', 404);
    }
    if (
      bytes.length !== row.size ||
      createHash('sha256').update(bytes).digest('hex') !== row.sha256
    )
      throw new Error('Media integrity failure');
    return { base64: bytes.toString('base64'), etag: row.sha256 };
  }
}
