import { IRequest } from 'itty-router';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { roleDefs, evaluationCriteria } from '../db/schema';
import { jsonResponse, errorResponse } from '../utils/response';
import { Env } from '../types';

type CF = [env: Env, ctx: ExecutionContext];

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
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiData = JSON.parse(cleanContent);
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
    const now = Date.now();

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

    // Check if RoleDef exists
    const existing = await db
      .select()
      .from(roleDefs)
      .where(eq(roleDefs.id, roleDefId))
      .limit(1);

    if (existing.length === 0) {
      return errorResponse('RoleDef not found', 404);
    }

    const now = Date.now();

    // Prepare update data
    const updateData: any = {
      updatedAt: now,
    };

    if (body.displayName) updateData.displayName = body.displayName;
    if (body.version) updateData.version = body.version;
    if (body.license) updateData.license = body.license;
    if (body.availability) updateData.availability = body.availability;
    if (body.maintainers) updateData.maintainers = JSON.stringify(body.maintainers);
    if (body.persona) updateData.persona = JSON.stringify(body.persona);
    if (body.capabilities) updateData.capabilities = JSON.stringify(body.capabilities);
    if (body.dependencies) updateData.dependencies = JSON.stringify(body.dependencies);
    if (body.documentation) updateData.documentation = JSON.stringify(body.documentation);
    if (body.preferredModels) updateData.preferredModels = JSON.stringify(body.preferredModels);
    if (body.prompts) updateData.prompts = JSON.stringify(body.prompts);
    if (body.spawnableSubAgents) updateData.spawnableSubAgents = JSON.stringify(body.spawnableSubAgents);

    // Update RoleDef
    await db.update(roleDefs).set(updateData).where(eq(roleDefs.id, roleDefId));

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
Return a JSON array of criteria objects, each with:
- name: string (criterion name)
- description: string (brief description)
- category: string (one of: technical, communication, architecture, devops, soft-skills, domain)
- defaultScore: number (1-5, suggested default score)

Suggest 8-12 relevant criteria based on the role and category provided.`;

    const userPrompt = `Suggest evaluation criteria for:
Role: ${role}
Category: ${category === 'all' ? 'all categories' : category}

Return only valid JSON array without any markdown formatting.`;

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
    let criteria;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      criteria = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return errorResponse('Failed to parse AI suggestions', 500);
    }

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
