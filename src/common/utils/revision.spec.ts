import { recordRevision, requireRevision } from './revision';

describe('record edit revisions', () => {
  it('detects reordered authored lists and rejects stale edits', () => {
    const before = { caseStudy: { gallery: [{ url: 'https://example.test/before.png' }, { url: 'https://example.test/after.png' }] } };
    const after = { caseStudy: { gallery: [...before.caseStudy.gallery].reverse() } };
    expect(recordRevision(after)).not.toBe(recordRevision(before));
    expect(() => requireRevision(after, recordRevision(before))).toThrow();
  });
  it('ignores object-key and unordered database relation order', () => {
    const before = { id: 1, links: [{ id: 2, url: 'b' }, { id: 1, url: 'a' }] };
    const after = { links: [...before.links].reverse(), id: 1 };
    expect(recordRevision(after)).toBe(recordRevision(before));
  });
});
