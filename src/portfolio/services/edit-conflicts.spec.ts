import { ExperienceResponsibilityService } from './experience-responsibility.service';
import { ExperienceRole } from '../models/experience-role.model';
import { ProjectService } from './project.service';
import { ProjectRepository } from '../repositories/project.repository';
import { PersonalInfoRepository } from '../repositories/personal-info.repository';
import { recordRevision, withRevision } from '../../common/utils/revision';
import { UpdateProjectDto } from '../dtos/project.dto';

it('rejects a stale project before saving or removing any links', async () => {
  const previous = { id: 1, name: 'Before', description: 'Original', isDraft: true, links: [{ id: 2, type: 'website', url: 'https://example.com' }], technologies: [] };
  const current = { ...previous, name: 'Changed by another editor' };
  const save = jest.fn(); const remove = jest.fn();
  const repository = { findOne: jest.fn().mockResolvedValue(current), save, delete: remove };
  const manager = { query: jest.fn(), getRepository: () => repository };
  const service = new ProjectService({ repo: { manager: { transaction: (action: (manager: unknown) => unknown) => action(manager) } } } as unknown as ProjectRepository);
  await expect(service.addOrUpdate({ id: 1, revision: recordRevision(previous), name: 'My stale edit', links: [] } as UpdateProjectDto)).rejects.toThrow('changed');
  expect(save).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});

it('rejects profile overwrites without a matching loaded revision', async () => {
  const current = { id: 1, name: 'Current profile' };
  const save = jest.fn();
  const manager = { query: jest.fn(), getRepository: () => ({ find: async () => [current], findOne: async () => current, save }) };
  const repository = new PersonalInfoRepository({ manager: { transaction: (action: (manager: unknown) => unknown) => action(manager) } } as never);
  await expect(repository.addOrUpdate({ name: 'Stale profile', revision: '0'.repeat(64) })).rejects.toThrow('changed');
  await expect(repository.addOrUpdate({ name: 'Create cannot overwrite an existing profile' })).rejects.toThrow('changed');
  expect(save).not.toHaveBeenCalled();
});

it('revisions survive JSON transport and detect relation edits', () => {
  const first = { id: 1, createdAt: new Date('2026-10-01T00:00:00Z'), links: [{ id: 2, url: 'https://example.com' }, { id: 1, url: 'https://example.org' }] };
  const transported = JSON.parse(JSON.stringify(withRevision(first)));
  transported.links.reverse();
  expect(recordRevision(transported)).toBe(recordRevision(first));
  transported.links[0].url = 'https://changed.example';
  expect(recordRevision(transported)).not.toBe(recordRevision(first));
});

it('reorders one complete role in one transaction and rejects stale or foreign IDs', async () => {
  const current = [{ id: 1, order: 0, description: 'First' }, { id: 2, order: 1, description: 'Second' }];
  const save = jest.fn(async rows => rows);
  const manager = { getRepository: (model: unknown) => model === ExperienceRole
    ? { findOne: async () => ({ id: 10 }) } : { find: async () => current, save } };
  const service = new ExperienceResponsibilityService({ repo: { manager: { transaction: async (action: (manager: unknown) => unknown) => action(manager) } } } as never);
  await expect(service.reorder({ roleId: 10, expectedIds: [1, 2], ids: [2, 1] })).resolves.toEqual([
    { ...current[1], order: 0 }, { ...current[0], order: 1 },
  ]);
  expect(save).toHaveBeenCalledTimes(1);
  for (const data of [{ expectedIds: [2, 1], ids: [1, 2] }, { expectedIds: [1, 2], ids: [1, 3] }, { expectedIds: [1, 2], ids: [1, 1] }]) {
    await expect(service.reorder({ roleId: 10, ...data })).rejects.toThrow('changed');
  }
  expect(save).toHaveBeenCalledTimes(1);
});
