import type { PortfolioData } from '../types/portfolio-data';

const xml = (value: string) =>
  Array.from(value)
    .filter(
      (char) => char.charCodeAt(0) >= 32 || ['\n', '\r', '\t'].includes(char),
    )
    .join('')
    .replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&apos;',
        })[char]!,
    );
export function portfolioFeed(
  data: PortfolioData,
  generatedAt: string,
): string {
  const base = new URL(data.profile.portfolio).origin;
  const entries = [
    ...(data.content?.articles ?? []).map((article) => ({
      id: `${base}/read${article.locale === 'en' ? '' : `?lang=${encodeURIComponent(article.locale)}`}#article-${article.id}`,
      title: article.title,
      date: article.date,
      summary: article.summary,
    })),
    ...data.projects.flatMap((project) =>
      (project.caseStudy?.milestones ?? []).map((milestone) => ({
        id: `${base}/projects/${project.id}#${encodeURIComponent(`milestone-${milestone.date}-${milestone.title}`)}`,
        title: `${project.name}: ${milestone.title}`,
        date: milestone.date,
        summary: milestone.description,
      })),
    ),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50);
  return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>${xml(base)}/</id><title>${xml(data.profile.name)}: writing and project updates</title><updated>${entries[0] ? `${entries[0].date}T00:00:00.000Z` : xml(generatedAt)}</updated><link href="${xml(base)}/read"/><author><name>${xml(data.profile.name)}</name></author>${entries.map((entry) => `<entry><id>${xml(entry.id)}</id><title>${xml(entry.title)}</title><link href="${xml(entry.id)}"/><updated>${entry.date}T00:00:00.000Z</updated><summary type="text">${xml(entry.summary)}</summary></entry>`).join('')}</feed>`;
}
