import { IRequest } from 'itty-router';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { roleDefs, evaluationCriteria } from '../db/schema';
import { jsonResponse, errorResponse } from '../utils/response';
import { Env } from '../types';

type CF = [env: Env, ctx: ExecutionContext];

// Helper function to extract JSON from AI response
function extractJSON(content: string): any {
  let cleaned = content.trim();

  // Remove all markdown code block markers
  cleaned = cleaned.replace(/```json\n?/g, '');
  cleaned = cleaned.replace(/```\n?/g, '');
  cleaned = cleaned.trim();

  // If still doesn't start with { or [, try to find JSON object
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    }
  }

  // Fix line breaks in JSON strings by normalizing whitespace in string values
  // This regex finds string values and replaces line breaks with spaces
  try {
    // First attempt: try parsing as-is
    return JSON.parse(cleaned);
  } catch (firstError) {
    // Second attempt: normalize line breaks in strings
    // Replace newlines followed by indentation with a space
    cleaned = cleaned.replace(/"\s*\n\s+/g, '" ');
    cleaned = cleaned.replace(/:\s*"([^"]*)\n\s+([^"]*)"/g, ': "$1 $2"');

    // Try parsing again
    return JSON.parse(cleaned);
  }
}

// List all RoleDefs
export async function listRoleDefs(request: IRequest, ...[env]: CF) {
  try {
    const db = drizzle(env.DB);
    const results = await db
      .select()
      .from(roleDefs)
      .orderBy(desc(roleDefs.createdAt));

    return jsonResponse(results);
  } catch (error) {
    console.error('Error listing roledefs:', error);
    return errorResponse('Failed to fetch roledefs', 500);
  }
}

// Get RoleDef by ID with evaluation criteria
export async function getRoleDefDetails(request: IRequest, ...[env]: CF) {
  try {
    const { roleDefId } = request.params;
    const db = drizzle(env.DB);

    // Get RoleDef
    const roleDef = await db
      .select()
      .from(roleDefs)
      .where(eq(roleDefs.id, roleDefId))
      .limit(1);

    if (roleDef.length === 0) {
      return errorResponse('RoleDef not found', 404);
    }

    // Get evaluation criteria
    const criteria = await db
      .select()
      .from(evaluationCriteria)
      .where(eq(evaluationCriteria.roleDefId, roleDefId));

    return jsonResponse({
      ...roleDef[0],
      evaluationCriteria: criteria,
    });
  } catch (error) {
    console.error('Error getting roledef details:', error);
    return errorResponse('Failed to fetch roledef details', 500);
  }
}

// Helper function to enrich RoleDef fields using AI
async function enrichRoleDefWithAI(body: any, env: Env): Promise<any> {
  // If AI enrichment is not requested or API key is not available, return body as-is
  if (!env.OPENROUTER_API_KEY) {
    return body;
  }

  // Extract user-provided data
  const name = body.name;
  const displayName = body.displayName;
  const purpose = body.persona?.purpose || '';

  // Only enrich if we have basic info and some fields are empty
  if (!name || !displayName || !purpose) {
    return body;
  }

  const persona = body.persona || {};
  const capabilities = body.capabilities || {};

  // Check if fields need enrichment
  const needsEnrichment =
    (!persona.values || persona.values.length === 0) ||
    (!persona.attributes || persona.attributes.length === 0) ||
    (!persona.tech_stack || persona.tech_stack.length === 0) ||
    (!capabilities.tags || capabilities.tags.length === 0) ||
    (!capabilities.descriptions || Object.keys(capabilities.descriptions).length === 0) ||
    (!capabilities.considerations || capabilities.considerations.length === 0);

  if (!needsEnrichment) {
    return body;
  }

  try {
    const systemPrompt = `You are an expert at creating detailed AI agent role definitions.
Given a role name, display name, and purpose, you will generate comprehensive details for the role definition.

Generate a JSON object with the following structure:
{
  "values": ["array of core values/principles for this role"],
  "attributes": ["array of key attributes/skills that define this role"],
  "tech_stack": ["array of relevant technologies, tools, and frameworks"],
  "tags": ["array of capability tags"],
  "descriptions": {"tag1": "description", "tag2": "description", ...},
  "considerations": ["array of important considerations, best practices, and guidelines"]
}

Important:
- Base your suggestions on the role's purpose and domain
- Be specific and detailed, similar to a professional role specification
- Include as many items as needed to fully capture the role's scope and requirements
- For tech_stack, include relevant languages, frameworks, tools, and platforms
- For tags, use lowercase-with-hyphens format
- For descriptions, create a mapping where each tag has a detailed description
- For considerations, provide actionable best practices and important guidelines
- Do not include any markdown formatting, just return valid JSON`;

    const userPrompt = `Role Name: ${name}
Display Name: ${displayName}
Purpose: ${purpose}

Generate comprehensive role definition details.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', await response.text());
      return body;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return body;
    }

    // Parse AI response
    let aiData;
    try {
      aiData = extractJSON(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return body;
    }

    // Merge AI data with user-provided data (user data takes precedence)
    const enrichedPersona = {
      purpose: persona.purpose || purpose,
      values: persona.values && persona.values.length > 0 ? persona.values : aiData.values || [],
      attributes: persona.attributes && persona.attributes.length > 0 ? persona.attributes : aiData.attributes || [],
      tech_stack: persona.tech_stack && persona.tech_stack.length > 0 ? persona.tech_stack : aiData.tech_stack || [],
    };

    const enrichedCapabilities = {
      tags: capabilities.tags && capabilities.tags.length > 0 ? capabilities.tags : aiData.tags || [],
      descriptions: capabilities.descriptions && Object.keys(capabilities.descriptions).length > 0
        ? capabilities.descriptions
        : aiData.descriptions || {},
      considerations: capabilities.considerations && capabilities.considerations.length > 0
        ? capabilities.considerations
        : aiData.considerations || [],
    };

    return {
      ...body,
      persona: enrichedPersona,
      capabilities: enrichedCapabilities,
    };
  } catch (error) {
    console.error('Error enriching with AI:', error);
    return body;
  }
}

// Create new RoleDef
export async function createRoleDef(request: IRequest, ...[env]: CF) {
  try {
    const body = await request.json();

    // Enrich the body with AI-generated fields
    const enrichedBody = await enrichRoleDefWithAI(body, env);

    const db = drizzle(env.DB);

    // Generate ID
    const id = `roledef_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date();

    // Prepare RoleDef data
    const roleDefData = {
      id,
      name: enrichedBody.name,
      displayName: enrichedBody.displayName,
      version: enrichedBody.version || '1.0.0',
      schemaVersion: enrichedBody.schemaVersion || '0.0.1',
      license: enrichedBody.license || 'MIT',
      availability: enrichedBody.availability || 'public',
      maintainers: JSON.stringify(enrichedBody.maintainers || []),
      persona: JSON.stringify(enrichedBody.persona),
      capabilities: JSON.stringify(enrichedBody.capabilities),
      dependencies: JSON.stringify(enrichedBody.dependencies),
      documentation: JSON.stringify(enrichedBody.documentation || []),
      preferredModels: JSON.stringify(enrichedBody.preferredModels || []),
      prompts: JSON.stringify(enrichedBody.prompts),
      spawnableSubAgents: JSON.stringify(enrichedBody.spawnableSubAgents || []),
      createdAt: now,
      updatedAt: now,
    };

    // Insert RoleDef
    await db.insert(roleDefs).values(roleDefData);

    // Insert evaluation criteria if provided
    if (enrichedBody.evaluationCriteria && Array.isArray(enrichedBody.evaluationCriteria)) {
      const criteriaData = enrichedBody.evaluationCriteria.map((criteria: any) => ({
        roleDefId: id,
        name: criteria.name,
        description: criteria.description || null,
        score: criteria.score,
        category: criteria.category || null,
        isCustom: criteria.isCustom ? 1 : 0,
        createdAt: now,
      }));

      await db.insert(evaluationCriteria).values(criteriaData);
    }

    return jsonResponse({ id, ...roleDefData }, 201);
  } catch (error) {
    console.error('Error creating roledef:', error);
    return errorResponse('Failed to create roledef', 500);
  }
}

// Update RoleDef
export async function updateRoleDef(request: IRequest, ...[env]: CF) {
  try {
    const { roleDefId } = request.params;
    const body = await request.json();
    const db = drizzle(env.DB);

    console.log('Updating RoleDef:', roleDefId);
    console.log('Body keys:', Object.keys(body));

    // Check if RoleDef exists
    const existing = await db
      .select()
      .from(roleDefs)
      .where(eq(roleDefs.id, roleDefId))
      .limit(1);

    if (existing.length === 0) {
      return errorResponse('RoleDef not found', 404);
    }

    const now = new Date();

    // Prepare update data - check for undefined, not just falsy values
    const updateData: any = {
      updatedAt: now,
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.version !== undefined) updateData.version = body.version;
    if (body.license !== undefined) updateData.license = body.license;
    if (body.availability !== undefined) updateData.availability = body.availability;
    if (body.maintainers !== undefined) updateData.maintainers = typeof body.maintainers === 'string' ? body.maintainers : JSON.stringify(body.maintainers);
    if (body.persona !== undefined) updateData.persona = typeof body.persona === 'string' ? body.persona : JSON.stringify(body.persona);
    if (body.capabilities !== undefined) updateData.capabilities = typeof body.capabilities === 'string' ? body.capabilities : JSON.stringify(body.capabilities);
    if (body.dependencies !== undefined) updateData.dependencies = typeof body.dependencies === 'string' ? body.dependencies : JSON.stringify(body.dependencies);
    if (body.documentation !== undefined) updateData.documentation = typeof body.documentation === 'string' ? body.documentation : JSON.stringify(body.documentation);
    if (body.preferredModels !== undefined) updateData.preferredModels = typeof body.preferredModels === 'string' ? body.preferredModels : JSON.stringify(body.preferredModels);
    if (body.prompts !== undefined) updateData.prompts = typeof body.prompts === 'string' ? body.prompts : JSON.stringify(body.prompts);
    if (body.spawnableSubAgents !== undefined) updateData.spawnableSubAgents = typeof body.spawnableSubAgents === 'string' ? body.spawnableSubAgents : JSON.stringify(body.spawnableSubAgents);

    console.log('Update data keys:', Object.keys(updateData));
    console.log('Sample update data:', {
      name: updateData.name,
      displayName: updateData.displayName,
      persona: typeof updateData.persona === 'string' ? updateData.persona.substring(0, 100) : updateData.persona
    });

    // Update RoleDef
    await db.update(roleDefs).set(updateData).where(eq(roleDefs.id, roleDefId));

    console.log('Update successful');

    return jsonResponse({ id: roleDefId, ...updateData });
  } catch (error) {
    console.error('Error updating roledef:', error);
    return errorResponse('Failed to update roledef', 500);
  }
}

// Delete RoleDef
export async function deleteRoleDef(request: IRequest, ...[env]: CF) {
  try {
    const { roleDefId } = request.params;
    const db = drizzle(env.DB);

    // Check if RoleDef exists
    const existing = await db
      .select()
      .from(roleDefs)
      .where(eq(roleDefs.id, roleDefId))
      .limit(1);

    if (existing.length === 0) {
      return errorResponse('RoleDef not found', 404);
    }

    // Delete RoleDef (cascade will delete evaluation criteria)
    await db.delete(roleDefs).where(eq(roleDefs.id, roleDefId));

    return jsonResponse({ message: 'RoleDef deleted successfully' });
  } catch (error) {
    console.error('Error deleting roledef:', error);
    return errorResponse('Failed to delete roledef', 500);
  }
}

// Enrich RoleDef from document upload
export async function enrichFromDocument(request: IRequest, ...[env]: CF) {
  try {
    if (!env.OPENROUTER_API_KEY) {
      return errorResponse('OpenRouter API key not configured', 500);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return errorResponse('No file provided', 400);
    }

    // Read file content
    const fileContent = await file.text();

    const systemPrompt = `You are an AI assistant that analyzes documents (resumes, job descriptions, etc.) and extracts relevant information for creating AI agent role definitions.

Analyze the document and extract:
- Relevant skills and technologies (for tech_stack and tags)
- Key attributes and qualities (for attributes)
- Core values or principles (for values)
- Capabilities and expertise areas (for capabilities)
- Best practices and considerations

CRITICAL: Return ONLY valid JSON without any markdown code blocks or formatting. All string values must be on a single line without line breaks.

Return a JSON object with this structure:
{
  "persona": {
    "values": ["array of core values/principles found"],
    "attributes": ["array of key attributes/skills"],
    "tech_stack": ["array of technologies, tools, frameworks mentioned"]
  },
  "capabilities": {
    "tags": ["array of capability tags"],
    "descriptions": {"tag1": "single line description without line breaks", ...},
    "considerations": ["array of best practices and guidelines"]
  },
  "documentation": [
    {"description": "description", "url": "relevant URL if mentioned"}
  ]
}

Only include information that is clearly mentioned or strongly implied in the document.`;

    const userPrompt = `Document content:\n\n${fileContent}\n\nExtract relevant information for an AI agent role definition. Return ONLY the JSON object without any markdown formatting or code blocks.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', await response.text());
      return errorResponse('Failed to process document', response.status);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return errorResponse('Invalid response from AI', 500);
    }

    let enrichedData;
    try {
      enrichedData = extractJSON(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return errorResponse('Failed to parse AI response', 500);
    }

    return jsonResponse(enrichedData);
  } catch (error) {
    console.error('Error enriching from document:', error);
    return errorResponse('Failed to enrich from document', 500);
  }
}

// Enrich RoleDef from URL
export async function enrichFromUrl(request: IRequest, ...[env]: CF) {
  try {
    if (!env.OPENROUTER_API_KEY) {
      return errorResponse('OpenRouter API key not configured', 500);
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return errorResponse('No URL provided', 400);
    }

    // Fetch URL content
    const urlResponse = await fetch(url);
    if (!urlResponse.ok) {
      return errorResponse('Failed to fetch URL', urlResponse.status);
    }

    const content = await urlResponse.text();

    const systemPrompt = `You are an AI assistant that analyzes web pages and documentation to extract relevant information for creating AI agent role definitions.

Analyze the content and extract:
- Relevant technologies and frameworks (for tech_stack)
- Key capabilities and features (for capabilities)
- Best practices and guidelines (for considerations)
- Documentation references

CRITICAL: Return ONLY valid JSON without any markdown code blocks or formatting. All string values must be on a single line without line breaks.

Return a JSON object with this structure:
{
  "persona": {
    "tech_stack": ["array of technologies mentioned"]
  },
  "capabilities": {
    "tags": ["array of capability tags"],
    "descriptions": {"tag1": "single line description without line breaks", ...},
    "considerations": ["array of best practices"]
  },
  "documentation": [
    {"description": "description", "url": "${url}"}
  ]
}`;

    const userPrompt = `Web page content:\n\n${content.substring(0, 10000)}\n\nExtract relevant information for an AI agent role definition. Return ONLY the JSON object without any markdown formatting or code blocks.`;

    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      console.error('OpenRouter API error:', await aiResponse.text());
      return errorResponse('Failed to process URL', aiResponse.status);
    }

    const data = await aiResponse.json() as any;
    const aiContent = data.choices?.[0]?.message?.content;

    if (!aiContent) {
      return errorResponse('Invalid response from AI', 500);
    }

    let enrichedData;
    try {
      enrichedData = extractJSON(aiContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      return errorResponse('Failed to parse AI response', 500);
    }

    return jsonResponse(enrichedData);
  } catch (error) {
    console.error('Error enriching from URL:', error);
    return errorResponse('Failed to enrich from URL', 500);
  }
}

// Enrich RoleDef from MCP configuration
export async function enrichFromMcp(request: IRequest, ...[env]: CF) {
  try {
    if (!env.OPENROUTER_API_KEY) {
      return errorResponse('OpenRouter API key not configured', 500);
    }

    const body = await request.json();
    const { config } = body;

    if (!config) {
      return errorResponse('No MCP configuration provided', 400);
    }

    const systemPrompt = `You are an AI assistant that analyzes MCP (Model Context Protocol) configurations and extracts relevant information for AI agent role definitions.

Analyze the MCP configuration and extract:
- Tools and capabilities (for capabilities)
- Technologies and dependencies (for dependencies)
- Available tools list

Return a JSON object with this structure:
{
  "capabilities": {
    "tags": ["array of capability tags based on tools"],
    "descriptions": {"tag1": "description of what this tool/capability does", ...}
  },
  "dependencies": {
    "available_tools": ["array of tool names from MCP config"]
  }
}`;

    const userPrompt = `MCP Configuration:\n\n${JSON.stringify(config, null, 2)}\n\nExtract relevant information for an AI agent role definition.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', await response.text());
      return errorResponse('Failed to process MCP configuration', response.status);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return errorResponse('Invalid response from AI', 500);
    }

    let enrichedData;
    try {
      enrichedData = extractJSON(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return errorResponse('Failed to parse AI response', 500);
    }

    return jsonResponse(enrichedData);
  } catch (error) {
    console.error('Error enriching from MCP:', error);
    return errorResponse('Failed to enrich from MCP configuration', 500);
  }
}

// Get suggested evaluation criteria (AI-generated)
export async function getSuggestedCriteria(request: IRequest, ...[env]: CF) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'general';
    const category = url.searchParams.get('category') || 'all';

    // Check if OpenRouter API key is configured
    if (!env.OPENROUTER_API_KEY) {
      return errorResponse('OpenRouter API key not configured', 500);
    }

    // Build the prompt for GPT-4o-mini
    const systemPrompt = `You are an AI assistant that suggests evaluation criteria for different roles and categories.
Return a JSON object with a "criteria" field containing an array of criteria objects, each with:
- name: string (criterion name)
- description: string (brief description)
- category: string (one of: technical, communication, architecture, devops, soft-skills, domain)
- defaultScore: number (1-5, suggested default score)

Suggest 8-12 relevant criteria based on the role and category provided.

Example format:
{
  "criteria": [
    {"name": "...", "description": "...", "category": "...", "defaultScore": 3}
  ]
}`;

    const userPrompt = `Suggest evaluation criteria for:
Role: ${role}
Category: ${category === 'all' ? 'all categories' : category}

Return only valid JSON object without any markdown formatting.`;

    // Call OpenRouter API with gpt-4o-mini
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': request.url,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return errorResponse('Failed to get AI suggestions', response.status);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return errorResponse('Invalid response from AI', 500);
    }

    // Parse the JSON response
    let result;
    try {
      result = extractJSON(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return errorResponse('Failed to parse AI suggestions', 500);
    }

    // Extract criteria array from the result
    const criteria = result.criteria || result;

    // Validate the response format
    if (!Array.isArray(criteria)) {
      return errorResponse('Invalid criteria format from AI', 500);
    }

    return jsonResponse({
      role,
      category,
      criteria,
    });
  } catch (error) {
    console.error('Error getting suggested criteria:', error);
    return errorResponse('Failed to fetch suggested criteria', 500);
  }
}
