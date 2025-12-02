import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HumanScore, EvaluationResult } from "@/lib/api-client";
import { TrendingUp, TrendingDown, Minus, Users, Brain } from "lucide-react";

interface HumanVsLLMComparisonProps {
  humanScores: HumanScore[];
  evaluations: EvaluationResult[];
}

export function HumanVsLLMComparison({ humanScores, evaluations }: HumanVsLLMComparisonProps) {
  if (humanScores.length === 0 || evaluations.length === 0) {
    return null;
  }

  // Calculate average human score
  const avgHumanScore = humanScores.reduce((sum, hs) => sum + hs.overallScore, 0) / humanScores.length;
  const avgHumanScoreOnFiveScale = (avgHumanScore * 4) + 1;

  // Calculate LLM overall score (weighted average of all evaluations)
  const totalLLMScore = evaluations.reduce((sum, e) => sum + e.score, 0);
  const totalMaxScore = evaluations.reduce((sum, e) => sum + e.maxScore, 0);
  const llmScoreNormalized = totalMaxScore > 0 ? totalLLMScore / totalMaxScore : 0;
  const llmScoreOnFiveScale = (llmScoreNormalized * 4) + 1;

  // Calculate agreement (how close the scores are)
  const scoreDiff = avgHumanScoreOnFiveScale - llmScoreOnFiveScale;
  const agreement = 100 - (Math.abs(scoreDiff) / 5) * 100;

  // Compare by category
  const categoryComparisons: Array<{
    category: string;
    humanAvg: number;
    llmScore: number;
    llmMaxScore: number;
    diff: number;
  }> = [];

  // Build map of LLM scores by category/evaluator name
  const llmScoresByCategory = new Map<string, { score: number; maxScore: number }>();
  evaluations.forEach(e => {
    llmScoresByCategory.set(e.evaluatorName, { score: e.score, maxScore: e.maxScore });
  });

  // Calculate human averages by category
  const humanCategoryScores = new Map<string, number[]>();
  humanScores.forEach(hs => {
    hs.scores.forEach(catScore => {
      const scores = humanCategoryScores.get(catScore.category) || [];
      scores.push(catScore.score);
      humanCategoryScores.set(catScore.category, scores);
    });
  });

  // Match categories
  humanCategoryScores.forEach((scores, category) => {
    const humanAvg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // Try to find matching LLM evaluation
    const llmData = llmScoresByCategory.get(category) ||
                   Array.from(llmScoresByCategory.entries()).find(([key]) =>
                     key.toLowerCase().includes(category.toLowerCase()) ||
                     category.toLowerCase().includes(key.toLowerCase())
                   )?.[1];

    if (llmData) {
      const llmScoreOnFive = (llmData.score / llmData.maxScore) * 5;
      categoryComparisons.push({
        category,
        humanAvg,
        llmScore: llmScoreOnFive,
        llmMaxScore: 5,
        diff: humanAvg - llmScoreOnFive,
      });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Human vs LLM Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Comparison */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-600">Human Average</span>
            </div>
            <div className="text-2xl font-bold">{avgHumanScoreOnFiveScale.toFixed(2)}/5</div>
            <div className="text-xs text-muted-foreground">
              {humanScores.length} scorer{humanScores.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-semibold text-purple-600">LLM Judge</span>
            </div>
            <div className="text-2xl font-bold">{llmScoreOnFiveScale.toFixed(2)}/5</div>
            <div className="text-xs text-muted-foreground">
              {evaluations.length} evaluation{evaluations.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="text-xs font-semibold mb-2">Agreement</div>
            <div className="text-2xl font-bold">{agreement.toFixed(0)}%</div>
            <div className="flex items-center gap-1 text-xs">
              {Math.abs(scoreDiff) < 0.5 ? (
                <>
                  <Minus className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">Strong agreement</span>
                </>
              ) : Math.abs(scoreDiff) < 1.0 ? (
                <>
                  <Minus className="h-3 w-3 text-yellow-600" />
                  <span className="text-yellow-600">Moderate agreement</span>
                </>
              ) : scoreDiff > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-blue-600" />
                  <span className="text-blue-600">Humans scored higher</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-600" />
                  <span className="text-red-600">LLM scored higher</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Category-by-Category Comparison */}
        {categoryComparisons.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 text-sm">Category Breakdown</h4>
            <div className="space-y-2">
              {categoryComparisons.map((comp) => (
                <div key={comp.category} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{comp.category}</span>
                    {Math.abs(comp.diff) < 0.5 ? (
                      <Badge variant="success" className="text-xs">
                        <Minus className="h-3 w-3 mr-1" />
                        Match
                      </Badge>
                    ) : comp.diff > 0 ? (
                      <Badge variant="info" className="text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        +{comp.diff.toFixed(1)}
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="text-xs">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        {comp.diff.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Human:
                      </span>
                      <span className="font-semibold">{comp.humanAvg.toFixed(1)}/5</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Brain className="h-3 w-3" />
                        LLM:
                      </span>
                      <span className="font-semibold">{comp.llmScore.toFixed(1)}/5</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        <div className="bg-muted p-4 rounded-lg text-sm">
          <div className="font-semibold mb-2">Insights</div>
          <ul className="space-y-1 text-muted-foreground">
            {agreement >= 80 && (
              <li>• Strong agreement between human and LLM evaluations</li>
            )}
            {agreement < 80 && agreement >= 60 && (
              <li>• Moderate agreement - some differences in assessment</li>
            )}
            {agreement < 60 && (
              <li>• Significant differences between human and LLM evaluations</li>
            )}
            {Math.abs(scoreDiff) > 1.0 && scoreDiff > 0 && (
              <li>• Humans scored notably higher than LLM - may indicate conservative LLM judge</li>
            )}
            {Math.abs(scoreDiff) > 1.0 && scoreDiff < 0 && (
              <li>• LLM scored notably higher than humans - may indicate optimistic LLM judge</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
