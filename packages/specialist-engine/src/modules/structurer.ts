/**
 * Structurer Module
 * Transforms extracted knowledge into specialist template structure
 * Generates complete skeleton matching shadcn-specialist-template.json5 format
 * Uses agency-prompt-creator for template substitution
 */

import { substituteTemplate } from 'agency-prompt-creator';
import type { ExtractedKnowledge, SpecialistTemplate, Persona, Capabilities } from '../types/index.js';

export function structure(
  knowledge: ExtractedKnowledge,
  options: {
    name: string;
    version: string;
    baseTemplate?: string;
  }
): SpecialistTemplate {
  console.log('[Structurer] Building specialist template...');

  const template: SpecialistTemplate = {
    schema_version: '0.0.1',
    name: options.name,
    displayName: options.name.split('/').pop()?.replace(/-specialist$/, '') || options.name,
    version: options.version,
    license: 'MIT',
    availability: 'public',
    maintainers: [
      {
        name: 'Zephyr Cloud Team',
        email: 'inbound@zephyr-cloud.io'
      }
    ],
    persona: buildPersona(knowledge),
    capabilities: buildCapabilities(knowledge),
    dependencies: buildDependencies(knowledge),
    documentation: buildDocumentation(knowledge),
    preferred_models: buildPreferredModels(),
    prompts: buildPrompts(knowledge),
    spawnable_sub_agent_specialists: []
  };

  console.log('[Structurer] Template structure created');
  return template;
}

function buildPersona(knowledge: ExtractedKnowledge): Persona {
  // Extract tech stack from concepts
  const techStack = knowledge.concepts
    .filter(c => c.importance === 'critical' || c.importance === 'high')
    .map(c => c.name)
    .slice(0, 10);

  // Generate purpose from domain and framework
  const purpose = `Expert ${knowledge.domain} specialist for ${knowledge.framework} projects`;

  // Extract values from best practices
  const values = knowledge.bestPractices
    .map(p => p.category)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 8);

  // Generate attributes from knowledge
  const attributes = [
    `Deep understanding of ${knowledge.domain} architecture`,
    `Expert in ${knowledge.framework} configuration`,
    `Follows official documentation exactly`
  ];

  return {
    purpose,
    values: values.length > 0 ? values : ['Performance first', 'Best practices', 'Clean code'],
    attributes,
    tech_stack: techStack.length > 0 ? techStack : [knowledge.framework]
  };
}

function buildCapabilities(knowledge: ExtractedKnowledge): Capabilities {
  // Generate tags from concepts
  const tags = knowledge.concepts
    .map(c => c.name.toLowerCase().replace(/\s+/g, '-'))
    .slice(0, 10);

  // Build descriptions
  const descriptions: Record<string, string> = {};
  for (const concept of knowledge.concepts.slice(0, 10)) {
    const tag = concept.name.toLowerCase().replace(/\s+/g, '-');
    descriptions[tag] = concept.description;
  }

  // Extract considerations from gotchas
  const considerations = knowledge.gotchas
    .filter(g => g.impact === 'critical' || g.impact === 'high')
    .map(g => g.description)
    .slice(0, 10);

  return {
    tags,
    descriptions,
    considerations: considerations.length > 0 ? considerations : ['Follow official documentation']
  };
}

function buildDependencies(knowledge: ExtractedKnowledge) {
  return {
    subscription: {
      required: false,
      purpose: 'No subscription required'
    },
    available_tools: [
      'file_system',
      'terminal',
      'code_analysis',
      'git',
      'web_fetch'
    ],
    mcps: []
  };
}

function buildDocumentation(knowledge: ExtractedKnowledge) {
  // Start with empty documentation array - will be populated during enrichment
  // Or add basic entries from knowledge sources if available
  const docs: any[] = [];
  
  if (knowledge.sources && knowledge.sources.length > 0) {
    for (const source of knowledge.sources) {
      if (source.type === 'documentation' && source.url) {
        docs.push({
          type: 'official',
          url: source.url,
          description: `${knowledge.domain} documentation`
        });
      }
    }
  }
  
  return docs;
}

function buildPreferredModels() {
  return [
    { model: 'anthropic/claude-sonnet-4.5' },
    { model: 'anthropic/claude-sonnet-3.5' },
    { model: 'openai/gpt-4o' }
  ];
}

function buildPrompts(knowledge: ExtractedKnowledge) {
  const critical = knowledge.gotchas
    .filter(g => g.impact === 'critical')
    .map((g, i) => `${i + 1}. ${g.title}: ${g.solution}`)
    .join('\n') || 'Follow best practices';

  // Build context for template substitution
  const context = {
    domain: knowledge.domain,
    framework: knowledge.framework,
    critical: critical
  };

  // Use template substitution for prompts that need knowledge values filled in
  // But keep {{variables}} for runtime substitution
  const defaultSpawnerTemplate = `I'm a {{domain}} specialist. I follow the official documentation exactly, understand {{domain}} architecture, and ensure proper configuration of {{framework}} projects.`;
  const defaultSpawnerPrompt = substituteTemplate(defaultSpawnerTemplate, context);

  const modelSpecificSpawnerTemplate = `I'm a {{domain}} specialist powered by Claude Sonnet 4.5. I have deep understanding of {{domain}} and {{framework}}.\n\nKey principles I follow:\n1. ALWAYS follow official {{framework}} documentation exactly\n2. Verify all configurations before proceeding\n3. Test build and functionality after setup\n\nCritical considerations:\n{{critical}}\n\nI excel at project setup, configuration, and troubleshooting common issues.`;
  const modelSpecificSpawnerPrompt = substituteTemplate(modelSpecificSpawnerTemplate, context);

  // Task-specific prompts use {{variables}} for runtime substitution
  // But we can substitute domain/framework from knowledge
  const projectSetupDefaultTemplate = `Set up a new {{framework}} project with {{domain}}, using {{packageManager}} and configuring {{features}}`;
  const projectSetupDefault = substituteTemplate(projectSetupDefaultTemplate, context);

  const projectSetupModelSpecificTemplate = `I'll set up a {{framework}} project with {{domain}} following the official documentation exactly:\n\n1. Create {{framework}} project with TypeScript template\n2. Configure {{domain}} dependencies\n3. Set up required configuration files\n4. Initialize {{domain}} with proper settings\n5. Configure {{features}} as requested\n6. Verify build succeeds\n\nI'll use {{packageManager}} and ensure all configurations match official documentation.`;
  const projectSetupModelSpecific = substituteTemplate(projectSetupModelSpecificTemplate, context);

  const componentAddDefaultTemplate = `Add {{componentName}} component to the project using the {{domain}} CLI`;
  const componentAddDefault = substituteTemplate(componentAddDefaultTemplate, context);

  const componentAddModelSpecificTemplate = `I'll add the {{componentName}} component using the official CLI:\n\n1. Run the appropriate {{domain}} command\n2. Verify component installed correctly\n3. Check dependencies were added\n4. Confirm component imports work\n5. Verify build still succeeds`;
  const componentAddModelSpecific = substituteTemplate(componentAddModelSpecificTemplate, context);

  const troubleshootDefaultTemplate = `Debug {{issueType}} issue in {{domain}} project: {{description}}`;
  const troubleshootDefault = substituteTemplate(troubleshootDefaultTemplate, context);

  const troubleshootModelSpecificTemplate = `I'll debug this {{issueType}} issue: {{description}}\n\nCommon causes:\n- Configuration errors: Check all config files\n- Dependency issues: Verify package versions\n- Build errors: Check build configuration\n\nI'll systematically check configuration and provide fixes based on official documentation.`;
  const troubleshootModelSpecific = substituteTemplate(troubleshootModelSpecificTemplate, context);

  const themeSetupDefault = `Configure theming with {{themeType}} using {{baseColor}} color palette`;

  const themeSetupModelSpecific = `I'll configure {{themeType}} theming with {{baseColor}} base color:\n\n1. Ensure theme configuration is correct\n2. Configure color tokens\n3. Set up theme switching if needed\n4. Verify all semantic tokens are defined\n5. Test theme functionality`;

  return {
    default: {
      spawnerPrompt: defaultSpawnerPrompt
    },
    model_specific: {
      'anthropic/claude-sonnet-4.5': {
        spawnerPrompt: modelSpecificSpawnerPrompt
      }
    },
    project_setup: {
      default: {
        systemPrompt: projectSetupDefault
      },
      model_specific: {
        'anthropic/claude-sonnet-4.5': {
          systemPrompt: projectSetupModelSpecific
        }
      }
    },
    component_add: {
      default: {
        systemPrompt: componentAddDefault
      },
      model_specific: {
        'anthropic/claude-sonnet-4.5': {
          systemPrompt: componentAddModelSpecific
        }
      }
    },
    troubleshoot: {
      default: {
        systemPrompt: troubleshootDefault
      },
      model_specific: {
        'anthropic/claude-sonnet-4.5': {
          systemPrompt: troubleshootModelSpecific
        }
      }
    },
    theme_setup: {
      default: {
        systemPrompt: themeSetupDefault
      },
      model_specific: {
        'anthropic/claude-sonnet-4.5': {
          systemPrompt: themeSetupModelSpecific
        }
      }
    },
    prompt_strategy: {
      fallback: 'default',
      model_detection: 'auto',
      allow_override: true,
      interpolation: {
        style: 'mustache',
        escape_html: false
      }
    }
  };
}