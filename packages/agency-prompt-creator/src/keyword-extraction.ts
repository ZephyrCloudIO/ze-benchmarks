/**
 * Keyword extraction utilities for user prompts
 * Extracts framework, library, component, and action keywords
 */

/**
 * Framework keywords and their aliases
 */
const FRAMEWORK_KEYWORDS: Record<string, string[]> = {
  vite: ['vite', 'vitejs'],
  next: ['next', 'nextjs', 'next.js'],
  react: ['react', 'reactjs', 'react.js'],
  vue: ['vue', 'vuejs', 'vue.js'],
  svelte: ['svelte', 'sveltejs'],
  angular: ['angular', 'angularjs'],
  nuxt: ['nuxt', 'nuxtjs', 'nuxt.js'],
  remix: ['remix', 'remix.run'],
  astro: ['astro', 'astrojs'],
  solid: ['solid', 'solidjs', 'solid.js'],
};

/**
 * Component/UI keywords
 */
const COMPONENT_KEYWORDS = [
  'button',
  'form',
  'input',
  'modal',
  'dialog',
  'card',
  'navbar',
  'nav',
  'header',
  'footer',
  'sidebar',
  'menu',
  'dropdown',
  'select',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'tabs',
  'accordion',
  'tooltip',
  'popover',
  'toast',
  'alert',
  'badge',
  'avatar',
  'table',
  'list',
  'grid',
  'pagination',
  'breadcrumb',
  'carousel',
  'skeleton',
  'spinner',
  'loader',
  'progress',
  'calendar',
  'datepicker',
  'chart',
];

/**
 * Tech stack keywords
 */
const TECH_KEYWORDS = [
  'typescript',
  'javascript',
  'tailwind',
  'css',
  'scss',
  'sass',
  'styled-components',
  'emotion',
  'radix',
  'shadcn',
  'mui',
  'chakra',
  'mantine',
  'ant',
  'antd',
];

/**
 * Extracted keywords from a user prompt
 */
export interface ExtractedKeywords {
  /** Primary framework (e.g., 'vite', 'next') */
  frameworks: string[];
  /** Competing frameworks that should be penalized */
  competingFrameworks: string[];
  /** Component keywords (e.g., 'button', 'form') */
  components: string[];
  /** Tech stack keywords (e.g., 'typescript', 'tailwind') */
  techStack: string[];
  /** All keywords combined (for fuzzy matching) */
  allKeywords: string[];
}

/**
 * Extract keywords from user prompt
 * Normalizes and categorizes keywords for documentation filtering
 *
 * @param userPrompt User's prompt text
 * @returns Extracted and categorized keywords
 */
export function extractKeywords(userPrompt: string): ExtractedKeywords {
  const normalizedPrompt = userPrompt.toLowerCase().trim();
  const words = normalizedPrompt.split(/\s+/);

  const frameworks: string[] = [];
  const components: string[] = [];
  const techStack: string[] = [];

  // Extract frameworks
  for (const [framework, aliases] of Object.entries(FRAMEWORK_KEYWORDS)) {
    for (const alias of aliases) {
      if (normalizedPrompt.includes(alias)) {
        if (!frameworks.includes(framework)) {
          frameworks.push(framework);
        }
        break;
      }
    }
  }

  // Extract components
  for (const component of COMPONENT_KEYWORDS) {
    if (normalizedPrompt.includes(component)) {
      components.push(component);
    }
  }

  // Extract tech stack
  for (const tech of TECH_KEYWORDS) {
    if (normalizedPrompt.includes(tech)) {
      techStack.push(tech);
    }
  }

  // Determine competing frameworks
  const competingFrameworks = getCompetingFrameworks(frameworks);

  // Combine all keywords for fuzzy matching
  const allKeywords = [
    ...frameworks,
    ...components,
    ...techStack,
  ];

  return {
    frameworks,
    competingFrameworks,
    components,
    techStack,
    allKeywords,
  };
}

/**
 * Get competing frameworks that should be penalized
 * For example, if user mentions 'vite', penalize 'next'
 */
function getCompetingFrameworks(mentionedFrameworks: string[]): string[] {
  const competing: string[] = [];

  // Framework competition rules
  const competitionRules: Record<string, string[]> = {
    vite: ['next', 'nuxt', 'remix'],
    next: ['vite', 'remix', 'astro'],
    remix: ['next', 'vite', 'nuxt'],
    nuxt: ['next', 'remix', 'vite'],
    astro: ['next', 'vite', 'remix'],
  };

  for (const framework of mentionedFrameworks) {
    const competitors = competitionRules[framework] || [];
    for (const competitor of competitors) {
      if (!competing.includes(competitor) && !mentionedFrameworks.includes(competitor)) {
        competing.push(competitor);
      }
    }
  }

  return competing;
}

/**
 * Check if text contains any of the given keywords
 * Case-insensitive matching
 *
 * @param text Text to search in
 * @param keywords Keywords to search for
 * @returns True if any keyword is found
 */
export function containsKeyword(text: string, keywords: string[]): boolean {
  if (!text || keywords.length === 0) {
    return false;
  }

  const normalizedText = text.toLowerCase();

  return keywords.some(keyword => {
    const normalizedKeyword = keyword.toLowerCase();
    return normalizedText.includes(normalizedKeyword);
  });
}

/**
 * Count how many keywords are present in text
 *
 * @param text Text to search in
 * @param keywords Keywords to search for
 * @returns Number of matching keywords
 */
export function countKeywordMatches(text: string, keywords: string[]): number {
  if (!text || keywords.length === 0) {
    return 0;
  }

  const normalizedText = text.toLowerCase();

  return keywords.filter(keyword => {
    const normalizedKeyword = keyword.toLowerCase();
    return normalizedText.includes(normalizedKeyword);
  }).length;
}
