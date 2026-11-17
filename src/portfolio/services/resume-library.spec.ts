import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import { EntityManager, Repository } from 'typeorm';
import { ResumeAssetsController } from '../controllers/resume-assets.controller';
import { PersonalInfo } from '../models/personal-info.model';
import { Resume } from '../models/resume.model';
import { PersonalInfoRepository } from '../repositories/personal-info.repository';
import { LocalResumeStorageService } from './local-resume-storage.service';
import { PersonalInfoService } from './personal-info.service';

const filename = 'resume-12345678-1234-4123-8123-123456789abc.pdf';
const url = `https://portfolio.example.test/api/v1/assets/resumes/${filename}`;
const pdf = Buffer.from('%PDF-1.7\nresume content');
const upload = {
  originalname: 'resume.pdf',
  mimetype: 'application/pdf',
  size: pdf.length,
  buffer: pdf,
} as Express.Multer.File;

function library() {
  let metadata: { id: number; filePath: string; url: string } | null = null;
  let fileExists = false;
  const profile = { id: 7, resumeUrl: 'https://example.test/previous.pdf' };
  const legacy = {
    findOne: jest.fn(async () => profile),
    update: jest.fn(async (_id: unknown, changes: Partial<typeof profile>) => {
      Object.assign(profile, changes);
      return { affected: 1 };
    }),
  };
  const personalInfo = {
    findPortfolio: jest.fn(async () => null),
  };
  const rows = {
    count: jest.fn(async () => (metadata ? 1 : 0)),
    save: jest.fn(async (value: { filePath: string; url: string }) => {
      metadata = { id: 1, ...value };
      return metadata;
    }),
    findOneBy: jest.fn(async () => metadata),
    delete: jest.fn(async () => {
      metadata = null;
      return { affected: 1 };
    }),
    existsBy: jest.fn(async (where: { filePath: string }) =>
      metadata?.filePath === where.filePath,
    ),
  };
  const manager = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) return [{ name: 'portfolio_studio' }];
      if (sql.includes(' AS used')) return [{ used: false }];
      return [];
    }),
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Resume) return rows;
      if (entity === PersonalInfo) return legacy;
      throw new Error('Unexpected repository');
    }),
    transaction: async <T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> =>
      operation(manager as unknown as EntityManager),
  };
  const repository = { ...rows, manager } as unknown as Repository<Resume>;
  const storage = {
    save: jest.fn(async () => {
      fileExists = true;
      return { filePath: filename, url };
    }),
    remove: jest.fn(async () => {
      fileExists = false;
    }),
    read: jest.fn(async () => ({
      fileName: filename,
      size: pdf.length,
      stream: Readable.from([pdf]),
    })),
  };
  const localStorage = storage as unknown as LocalResumeStorageService;
  return {
    service: new PersonalInfoService(
      personalInfo as unknown as PersonalInfoRepository,
      repository,
      localStorage,
    ),
    assets: new ResumeAssetsController(localStorage, repository),
    storage,
    rows,
    legacy,
    personalInfo,
    profile,
    metadata: () => metadata,
    fileExists: () => fileExists,
  };
}

describe('Resume library on a fresh database', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uploads without a legacy profile and leaves the public profile link unchanged', async () => {
    const app = library();
    await expect(app.service.uploadResume(upload)).resolves.toMatchObject({ url });
    expect(app.metadata()).toEqual({ id: 1, filePath: filename, url });
    expect(app.fileExists()).toBe(true);
    expect(app.personalInfo.findPortfolio).not.toHaveBeenCalled();
    expect(app.legacy.findOne).not.toHaveBeenCalled();
    expect(app.legacy.update).not.toHaveBeenCalled();
    expect(app.profile.resumeUrl).toBe('https://example.test/previous.pdf');
  });

  it('keeps the library quota and removes an upload rejected by that quota', async () => {
    const app = library();
    app.rows.count.mockResolvedValue(20);
    await expect(app.service.uploadResume(upload)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(app.rows.save).not.toHaveBeenCalled();
    expect(app.storage.remove).toHaveBeenCalledWith(filename);
    expect(app.fileExists()).toBe(false);
    expect(app.metadata()).toBeNull();
  });

  it('cleans up the PDF when saving its database entry fails', async () => {
    const app = library();
    const failure = new Error('Database write failed');
    app.rows.save.mockRejectedValueOnce(failure);
    await expect(app.service.uploadResume(upload)).rejects.toBe(failure);
    expect(app.storage.remove).toHaveBeenCalledWith(filename);
    expect(app.fileExists()).toBe(false);
    expect(app.metadata()).toBeNull();
  });

  it('does not read storage for a PDF without a library entry', async () => {
    const app = library();
    await app.storage.save();
    expect(app.fileExists()).toBe(true);
    await expect(app.assets.read(filename)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(app.storage.read).not.toHaveBeenCalled();
  });

  it('serves the PDF bytes when the file has a library entry', async () => {
    const app = library();
    await app.service.uploadResume(upload);
    const response = await app.assets.read(filename);
    expect(response.getHeaders()).toEqual({
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
      length: pdf.length,
    });
    const chunks: Buffer[] = [];
    for await (const chunk of response.getStream()) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(pdf);
  });

  it('reports pending disk cleanup and blocks the removed PDF URL', async () => {
    const app = library();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await app.service.uploadResume(upload);
    app.storage.remove.mockRejectedValueOnce(new Error('Disk removal failed'));
    await expect(app.service.deleteResume(1)).resolves.toMatchObject({
      cleanupPending: true,
    });
    expect(app.metadata()).toBeNull();
    expect(app.fileExists()).toBe(true);
    await expect(app.assets.read(filename)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(app.storage.read).not.toHaveBeenCalled();
  });
});
