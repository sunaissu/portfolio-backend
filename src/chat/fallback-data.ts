export const fallbackProfile = {
  name: 'Brett Josef C. Galvez',
  title: 'Mid-Level App Developer',
  location: 'Cebu City, Philippines',
  email: 'galvezbrett17@gmail.com',
  linkedin: 'https://www.linkedin.com/in/brett-galvez',
  portfolio: 'https://github.com/sunaissu',
  summary:
    'Mid-Level Application Developer at Theoria Medical with experience in full-stack development, system architecture optimization, and healthcare technology.',
};

export const fallbackProjects = [
  {
    name: 'Thync Space',
    description:
      'A full-stack note-taking web app with Google OAuth authentication. Uses the @sunnaissu/noteboard package for whiteboard-style notes.',
    technologies: ['Next.js', 'Express.js', 'MongoDB', 'Passport.js'],
  },
  {
    name: '@sunnaissu/noteboard',
    description: 'An npm package for whiteboard-style note components.',
    technologies: ['Node.js', 'npm'],
  },
  {
    name: 'Steam Discount Notifier',
    description:
      'A lambda command that sends an automatic email when a fully discounted game is detected on Steam.',
    technologies: ['AWS Lambda', 'Python'],
  },
  {
    name: 'BRAMK',
    description:
      'Uses LLM to empower MSMEs by enabling them to automate customer support and queries based on their own datasets. Includes data gathering and metrics features to provide insights on business trends.',
    technologies: ['React', 'Node.js', 'LLM/AI'],
  },
];

export const fallbackSkills = [
  {
    category: 'Languages',
    items: ['TypeScript', 'JavaScript', 'PHP'],
  },
  {
    category: 'Frontend',
    items: ['React.js', 'Next.js', 'TailwindCSS', 'Vue.JS'],
  },
  {
    category: 'Backend',
    items: [
      'Node.js',
      'Laravel',
      'Nest.js',
      'ElasticSearch',
      'RestAPI',
      'GraphQL',
      'Express.js',
    ],
  },
  {
    category: 'Tools & DB',
    items: [
      'Claude',
      'Codex',
      'Git/GitHub',
      'Docker',
      'GCP',
      'AWS',
      'MySQL',
      'MongoDB',
      'Figma',
    ],
  },
];

export const fallbackExperience = [
  {
    company: 'Theoria Medical',
    description:
      'A tech-enabled, value-based healthcare company that leverages proprietary clinical platforms and telemedicine to provide primary care for senior living communities across the US.',
    roles: [
      {
        title: 'Mid-Level Application Developer',
        duration: 'Jun 2025 – Present',
        isCurrent: true,
        responsibilities: [
          'Optimized system architecture, reducing infrastructure up to 86%, significantly improving query performance and reducing operational costs.',
          'Migrated legacy monolithic components into a distributed microservices architecture to improve system scalability, fault tolerance, and long-term maintainability.',
          'Enforced engineering standards via code reviews, unit/integration testing, and technical documentation.',
          'Guided junior engineers on feature implementation, enforcing clean code practices and healthcare-grade security standards.',
          'Maintained secure billing, complex APIs, and clinical data modules under strict medical standards.',
        ],
      },
      {
        title: 'Full Stack Developer',
        duration: 'Apr 2024 – May 2025',
        isCurrent: false,
        responsibilities: [
          'Collaborated with cross-functional teams to translate complex business and compliance requirements into functional software specifications.',
          'Bolstered application stability and ensured seamless feature rollouts by implementing comprehensive E2E testing suites.',
          'Integrated backend API endpoints to support evolving core business workflow.',
        ],
      },
    ],
  },
  {
    company: 'Sun* Philippines',
    description:
      'A prominent Philippine enterprise focused on driving digital transformation, expanding consumer digital services, and building modern web-based solutions.',
    roles: [
      {
        title: 'Web Developer Intern',
        duration: 'Jan 2024 – Apr 2024',
        isCurrent: false,
        responsibilities: [
          'Participated in the end-to-end SDLC, driving the project from initial UI/UX prototyping in Figma to final product presentation.',
          'Streamlined team development by standardizing environments and establishing CI/CD pipelines via GitHub Workflows.',
        ],
      },
    ],
  },
];
