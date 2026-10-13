import { normalizeCaseStudy } from '../types/project-case-study';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectDto } from '../dtos/project.dto';

describe('published case-study contract', () => {
  it('requires HTTPS evidence, accessible media descriptions and valid bounded dates', async () => {
    const valid = { kind: 'Library', role: 'Maintainer', outcomes: [{ claim: 'Reviewed result', evidenceUrl: 'https://example.test/evidence' }], gallery: [{ type: 'image', url: 'https://example.test/image.png', caption: 'A reviewed image', alternative: 'Text description' }], milestones: [{ date: '2026-10-13', title: 'Review completed' }], dependencies: [2] };
    expect(normalizeCaseStudy(valid)?.outcomes[0].evidenceUrl).toBe('https://example.test/evidence');
    expect(await validate(plainToInstance(CreateProjectDto, { name: 'Project', description: 'Description', caseStudy: valid }))).toHaveLength(0);
    for (const invalid of [
      { adminNotes: 'must not leak' },
      { gallery: [{ ...valid.gallery[0], url: 'javascript:alert(1)' }] },
      { gallery: [{ ...valid.gallery[0], alternative: '' }] },
      { outcomes: [{ claim: 'Unattributed outcome' }] },
      { outcomes: [{ ...valid.outcomes[0], evidenceUrl: 'https://user:secret@example.test' }] },
      { milestones: [{ date: '2026-02-30', title: 'Invalid date' }] },
      { dependencies: [2, 2] }, { dependencies: ['$where'] },
      { problem: 'x'.repeat(4001) }, { gallery: Array(13).fill(valid.gallery[0]) },
    ]) {
      expect(() => normalizeCaseStudy(invalid)).toThrow();
      expect((await validate(plainToInstance(CreateProjectDto, { name: 'Project', description: 'Description', caseStudy: invalid }))).length).toBeGreaterThan(0);
    }
  });
  it('retains authored list order and rejects oversized combined content', () => {
    expect(normalizeCaseStudy({ walkthrough: [{ title: 'Second', body: 'B' }, { title: 'First', body: 'A' }] })?.walkthrough.map(step => step.title)).toEqual(['Second', 'First']);
    expect(() => normalizeCaseStudy({ decisions: Array(12).fill({ title: 'Decision', choice: 'x'.repeat(2000), tradeoff: 'y'.repeat(2000) }) })).toThrow(/24,000/);
    expect(normalizeCaseStudy(null)).toBeNull();
  });
});
