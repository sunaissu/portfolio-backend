import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  LocalResumeStorageService,
  MAX_RESUME_SIZE_BYTES,
} from './local-resume-storage.service';
import { PersonalInfoService } from './personal-info.service';
import { PersonalInfo } from '../models/personal-info.model';
import { Resume } from '../models/resume.model';

const pdf = Buffer.from('%PDF-1.7\nA test resume\n%%EOF');

describe('local resume storage', () => {
  // Windows sandbox denies symlink creation. Docker's Linux build runs both guards.
  const itWithSymlinks = process.platform === 'win32' ? it.skip : it;
  let temporary: string;
  let root: string;
  let storage: LocalResumeStorageService;
  beforeEach(async () => {
    temporary = await mkdtemp(join(tmpdir(), 'portfolio-resume-test-'));
    root = join(temporary, 'uploads');
    storage = new LocalResumeStorageService(
      new ConfigService({
        storage: { root, publicBaseUrl: 'https://api.example.test/' },
      }),
    );
  });
  afterEach(async () => {
    await rm(temporary, { recursive: true, force: true });
  });

  it('persists separate PDF files, streams them, and removes only the requested file', async () => {
    const first = await storage.save(pdf);
    const second = await storage.save(pdf);
    expect(first.filePath).not.toBe(second.filePath);
    expect(first.url).toBe(
      `https://api.example.test/api/v1/assets/resumes/${first.filePath}`,
    );
    const read = await storage.read(first.filePath);
    const chunks: Buffer[] = [];
    for await (const chunk of read.stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(pdf);
    expect(read.size).toBe(pdf.length);
    await storage.remove(first.filePath);
    await storage.remove(first.filePath);
    await expect(storage.read(first.filePath)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await readFile(join(root, 'resumes', second.filePath))).toEqual(pdf);
  });

  it.each([
    undefined,
    'http://api.example.test',
    'https://user:secret@api.example.test',
    'https://api.example.test/api',
    'https://api.example.test/?query=1',
  ])(
    'fails closed for unusable public URL %s without writing a file',
    async (publicBaseUrl) => {
      const unavailable = new LocalResumeStorageService(
        new ConfigService({ storage: { root, publicBaseUrl } }),
      );
      await expect(unavailable.save(pdf)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(await readdir(temporary)).toEqual([]);
    },
  );

  it('allows reading existing PDFs when the public URL is not configured', async () => {
    const saved = await storage.save(pdf);
    const reader = new LocalResumeStorageService(
      new ConfigService({ storage: { root } }),
    );
    const file = await reader.read(saved.filePath);
    for await (const _chunk of file.stream) {
      /* Consume and close the descriptor. */
    }
    expect(file.size).toBe(pdf.length);
  });

  it.each([
    '../secret.pdf',
    '..\\secret.pdf',
    '%2e%2e%2fsecret.pdf',
    '/etc/passwd',
    'anything.pdf',
    'resume-00000000-0000-4000-8000-000000000000.pdf/../secret',
  ])('rejects unsafe or unrecognized filenames: %s', async (name) => {
    await expect(storage.read(name)).rejects.toBeInstanceOf(NotFoundException);
    await expect(storage.remove(name)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects non-PDF content and files over 5 MB', async () => {
    await expect(
      storage.save(Buffer.from('<html>bad</html>')),
    ).rejects.toBeInstanceOf(BadRequestException);
    const large = Buffer.alloc(MAX_RESUME_SIZE_BYTES + 1);
    pdf.copy(large);
    await expect(storage.save(large)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const saved = await storage.save(pdf);
    await writeFile(
      join(root, 'resumes', saved.filePath),
      '<html>changed</html>',
    );
    await expect(storage.read(saved.filePath)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  itWithSymlinks(
    'rejects a symlink replacing the resumes directory',
    async () => {
      await mkdir(root);
      const outside = join(temporary, 'outside');
      await mkdir(outside);
      const name = 'resume-00000000-0000-4000-8000-000000000000.pdf';
      await writeFile(join(outside, name), pdf);
      await symlink(
        outside,
        join(root, 'resumes'),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      await expect(storage.read(name)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(storage.save(pdf)).rejects.toBeInstanceOf(NotFoundException);
      await expect(storage.remove(name)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(await readFile(join(outside, name))).toEqual(pdf);
    },
  );

  itWithSymlinks('rejects a symlink replacing an individual PDF', async () => {
    const saved = await storage.save(pdf);
    const outside = join(temporary, 'outside.pdf');
    await writeFile(outside, pdf);
    await storage.remove(saved.filePath);
    await symlink(outside, join(root, 'resumes', saved.filePath), 'file');
    await expect(storage.read(saved.filePath)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(storage.remove(saved.filePath)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await readFile(outside)).toEqual(pdf);
  });

  it('cleans only its new file when metadata rolls back or the 20-file quota rejects an upload', async () => {
    const existing = await storage.save(pdf);
    const failure = new Error('Transaction failed');
    const transaction = jest.fn().mockRejectedValueOnce(failure);
    const service = new PersonalInfoService(
      { findPortfolio: async () => ({ id: 1 }) } as any,
      { manager: { transaction } } as any,
      storage,
    );
    const file = {
      originalname: 'resume.pdf',
      mimetype: 'application/pdf',
      size: pdf.length,
      buffer: pdf,
    } as Express.Multer.File;
    await expect(service.uploadResume(file)).rejects.toBe(failure);
    expect(await readdir(join(root, 'resumes'))).toEqual([existing.filePath]);
    transaction.mockImplementation(async (callback) =>
      callback({
        query: async () => [],
        getRepository: () => ({ count: async () => 20 }),
      }),
    );
    await expect(service.uploadResume(file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(await readdir(join(root, 'resumes'))).toEqual([existing.filePath]);
  });

  it('keeps the PDF available when a delete transaction fails, and removes it after a successful commit', async () => {
    const saved = await storage.save(pdf);
    const record = { id: 1, ...saved };
    const manager = {
      query: async () => [],
      getRepository: (model: unknown) =>
        model === Resume
          ? { findOneBy: async () => record, delete: async () => undefined }
          : model === PersonalInfo
            ? { findOne: async () => null }
            : undefined,
    };
    const transaction = jest.fn(async (callback) => {
      await callback(manager);
      throw new Error('Commit failed');
    });
    const service = new PersonalInfoService(
      {} as any,
      { manager: { transaction } } as any,
      storage,
    );
    await expect(service.deleteResume(1)).rejects.toThrow('Commit failed');
    expect(await readFile(join(root, 'resumes', saved.filePath))).toEqual(pdf);
    transaction.mockImplementation(async (callback) => callback(manager));
    await expect(service.deleteResume(1)).resolves.toEqual({
      message: 'Unused resume deleted',
    });
    await expect(storage.read(saved.filePath)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
