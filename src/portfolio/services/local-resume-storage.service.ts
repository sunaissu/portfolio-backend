import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
const RESUME_FILENAME =
  /^resume-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/;

@Injectable()
export class LocalResumeStorageService {
  constructor(private readonly config: ConfigService) {}

  async save(buffer: Buffer): Promise<{ filePath: string; url: string }> {
    this.assertLocal();
    const origin = this.publicOrigin();
    if (
      buffer.length < 5 ||
      buffer.length > MAX_RESUME_SIZE_BYTES ||
      buffer.subarray(0, 5).toString('ascii') !== '%PDF-'
    ) {
      throw new BadRequestException('A valid PDF up to 5 MB is required');
    }
    const directory = await this.directory(true);
    const filePath = `resume-${randomUUID()}.pdf`;
    const path = join(directory, filePath);
    // Exclusive creation prevents replacing an existing file, including a symlink.
    const handle = await open(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        (constants.O_NOFOLLOW || 0),
      0o600,
    );
    try {
      await handle.writeFile(buffer);
      await handle.sync();
    } catch (error) {
      await handle.close();
      await unlink(path).catch(() => undefined);
      throw error;
    }
    await handle.close();
    return { filePath, url: `${origin}/api/v1/assets/resumes/${filePath}` };
  }

  async read(fileName: string) {
    this.assertLocal();
    this.assertFileName(fileName);
    try {
      const path = join(await this.directory(false), fileName);
      const before = await lstat(path);
      if (!before.isFile() || before.isSymbolicLink())
        throw new NotFoundException('Resume not found');
      const handle = await open(
        path,
        constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
      );
      try {
        const stat = await handle.stat();
        if (
          !stat.isFile() ||
          stat.ino !== before.ino ||
          stat.size < 5 ||
          stat.size > MAX_RESUME_SIZE_BYTES
        ) {
          throw new NotFoundException('Resume not found');
        }
        const signature = Buffer.alloc(5);
        await handle.read(signature, 0, 5, 0);
        if (signature.toString('ascii') !== '%PDF-')
          throw new NotFoundException('Resume not found');
        return {
          stream: handle.createReadStream({ start: 0, autoClose: true }),
          size: stat.size,
          fileName,
        };
      } catch (error) {
        await handle.close();
        throw error;
      }
    } catch (error) {
      if (
        this.isMissing(error) ||
        (error as NodeJS.ErrnoException).code === 'ELOOP'
      )
        throw new NotFoundException('Resume not found');
      throw error;
    }
  }

  async remove(fileName: string): Promise<void> {
    this.assertLocal();
    this.assertFileName(fileName);
    try {
      const path = join(await this.directory(false), fileName);
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new BadRequestException('Invalid resume file');
      await unlink(path);
    } catch (error) {
      if (!this.isMissing(error)) throw error;
    }
  }

  private assertLocal() {
    if (this.config.get<string>('storage.provider', 'local') !== 'local') {
      throw new ServiceUnavailableException('Resume storage is not configured');
    }
  }

  private publicOrigin(): string {
    try {
      const value = this.config.get<string>('storage.publicBaseUrl');
      if (!value) throw new Error('Missing public URL');
      const url = new URL(value);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      )
        throw new Error('Invalid public URL');
      return url.origin;
    } catch {
      throw new ServiceUnavailableException(
        'Set PUBLIC_API_URL to the HTTPS API origin before uploading resumes',
      );
    }
  }

  private assertFileName(fileName: string) {
    if (!RESUME_FILENAME.test(fileName))
      throw new NotFoundException('Resume not found');
  }

  private async directory(create: boolean): Promise<string> {
    const root = resolve(
      this.config.get<string>('storage.root', '/app/data/uploads'),
    );
    if (create) await mkdir(root, { recursive: true, mode: 0o700 });
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink())
      throw new NotFoundException('Resume storage unavailable');
    const canonicalRoot = await realpath(root);
    const directory = join(canonicalRoot, 'resumes');
    if (create) await mkdir(directory, { recursive: true, mode: 0o700 });
    const directoryStat = await lstat(directory);
    if (
      !directoryStat.isDirectory() ||
      directoryStat.isSymbolicLink() ||
      (await realpath(directory)) !== directory
    ) {
      throw new NotFoundException('Resume storage unavailable');
    }
    return directory;
  }

  private isMissing(error: unknown): boolean {
    return ['ENOENT', 'ENOTDIR'].includes(
      (error as NodeJS.ErrnoException).code || '',
    );
  }
}
