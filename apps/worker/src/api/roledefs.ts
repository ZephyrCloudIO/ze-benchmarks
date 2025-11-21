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

// Create new RoleDef
export async function createRoleDef(request: IRequest, ...[env]: CF) {
  try {
    const body = await request.json();
    const db = drizzle(env.DB);

    // Generate ID
    const id = `roledef_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    // Prepare RoleDef data
    const roleDefData = {
      id,
      name: body.name,
      displayName: body.displayName,
      version: body.version || '1.0.0',
      schemaVersion: body.schemaVersion || '0.0.1',
      license: body.license || 'MIT',
      availability: body.availability || 'public',
      maintainers: JSON.stringify(body.maintainers || []),
      persona: JSON.stringify(body.persona),
      capabilities: JSON.stringify(body.capabilities),
      dependencies: JSON.stringify(body.dependencies),
      documentation: JSON.stringify(body.documentation || []),
      preferredModels: JSON.stringify(body.preferredModels || []),
      prompts: JSON.stringify(body.prompts),
      spawnableSubAgents: JSON.stringify(body.spawnableSubAgents || []),
      createdAt: now,
      updatedAt: now,
    };

    // Insert RoleDef
    await db.insert(roleDefs).values(roleDefData);

    // Insert evaluation criteria if provided
    if (body.evaluationCriteria && Array.isArray(body.evaluationCriteria)) {
      const criteriaData = body.evaluationCriteria.map((criteria: any) => ({
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
