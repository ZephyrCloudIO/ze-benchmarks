import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CategoryScorer } from "./CategoryScorer";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiClient, type HumanScoreSubmission, type CategoryScore, type EvaluationResult } from "@/lib/api-client";

interface ScoreFormProps {
  runId: string;
  categories: string[];
  evaluations?: EvaluationResult[];
  onSubmitSuccess?: () => void;
}

export function ScoreForm({ runId, categories, evaluations, onSubmitSuccess }: ScoreFormProps) {
  const queryClient = useQueryClient();

  console.debug(`[HumanScorer:Form] ScoreForm initialized for runId: ${runId}`, {
    categoriesCount: categories.length,
    categories: categories,
    hasEvaluations: !!evaluations
  });

  // Form state
  const [scorerName, setScorerName] = useState("");
  const [scorerEmail, setScorerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [startTime] = useState(Date.now());

  // Category scores state
  const [categoryScores, setCategoryScores] = useState<Record<string, CategoryScore>>(() => {
    const initial: Record<string, CategoryScore> = {};
    categories.forEach((cat) => {
      initial[cat] = {
        category: cat,
        score: 3, // Default to middle score
        confidence: 70, // Default confidence
        reasoning: "",
      };
    });
    return initial;
  });

  // Calculate overall score (normalized to 0-1.0)
  const overallScore = (() => {
    const scores = Object.values(categoryScores);
    if (scores.length === 0) return 0;
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    return (avgScore - 1) / 4; // Convert 1-5 scale to 0-1.0
  })();

  // Time tracking
  const [timeSpent, setTimeSpent] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Find LLM score for a category
  const getLLMScoreForCategory = (category: string) => {
    if (!evaluations) return undefined;
    // Try to find a matching evaluation by name
    const evaluation = evaluations.find((e) =>
      e.evaluatorName.toLowerCase().includes(category.toLowerCase()) ||
      category.toLowerCase().includes(e.evaluatorName.toLowerCase())
    );
    return evaluation
      ? {
          score: evaluation.score,
          maxScore: evaluation.maxScore,
          details: evaluation.details,
        }
      : undefined;
  };

  // Update category score
  const updateCategoryScore = (category: string, updates: Partial<CategoryScore>) => {
    setCategoryScores((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        ...updates,
      },
    }));
  };

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const submission: HumanScoreSubmission = {
        scorerName: scorerName.trim(),
        scorerEmail: scorerEmail.trim() || undefined,
        scores: Object.values(categoryScores),
        overallScore,
        timeSpentSeconds: timeSpent,
        notes: notes.trim() || undefined,
        metadata: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      };
      console.debug(`[HumanScorer:Form] Submitting scores:`, {
        categories: Object.keys(categoryScores),
        overallScore,
        timeSpentSeconds: timeSpent,
        scorerName: submission.scorerName
      });
      return apiClient.submitHumanScore(runId, submission);
    },
    onSuccess: () => {
      console.debug(`[HumanScorer:Form] Score submission successful`);
      queryClient.invalidateQueries({ queryKey: ["humanScores", runId] });
      queryClient.invalidateQueries({ queryKey: ["humanScoreStats"] });
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    },
    onError: (error) => {
      console.debug(`[HumanScorer:Form] Score submission failed:`, error);
    },
  });

  // Form validation
  const isValid = scorerName.trim().length > 0;
  const allScored = Object.values(categoryScores).every((cs) => cs.score >= 1 && cs.score <= 5);

  // Log validation state changes
  useEffect(() => {
    console.debug(`[HumanScorer:Form] Validation state:`, {
      isValid,
      allScored,
      categoriesScored: Object.values(categoryScores).filter(cs => cs.score >= 1 && cs.score <= 5).length
    });
  }, [isValid, allScored, categoryScores]);

  return (
    <div className="space-y-4">
      {/* Scorer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scorer Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scorerName">Name *</Label>
            <Input
              id="scorerName"
              value={scorerName}
              onChange={(e) => setScorerName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scorerEmail">Email (optional)</Label>
            <Input
              id="scorerEmail"
              type="email"
              value={scorerEmail}
              onChange={(e) => setScorerEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Scores */}
      {categories.map((category) => (
        <CategoryScorer
          key={category}
          category={category}
          score={categoryScores[category].score}
          confidence={categoryScores[category].confidence || 70}
          reasoning={categoryScores[category].reasoning || ""}
          onScoreChange={(score) => updateCategoryScore(category, { score })}
          onConfidenceChange={(confidence) => updateCategoryScore(category, { confidence })}
          onReasoningChange={(reasoning) => updateCategoryScore(category, { reasoning })}
          llmScore={getLLMScoreForCategory(category)}
        />
      ))}

      {/* Additional Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any general comments about this benchmark run..."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      {/* Summary & Submit */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall Score</span>
              <span className="text-2xl font-bold">
                {Object.values(categoryScores)
                  .reduce((sum, s) => sum + s.score, 0) / categories.length}
                /5
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Normalized</span>
              <span className="font-medium">{overallScore.toFixed(3)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Time Spent</span>
              <span className="font-medium">{formatTime(timeSpent)}</span>
            </div>
            <Separator />
            <Button
              className="w-full"
              size="lg"
              disabled={!isValid || !allScored || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Score"}
            </Button>
            {submitMutation.isError && (
              <div className="text-sm text-destructive">
                Failed to submit score. Please try again.
              </div>
            )}
            {submitMutation.isSuccess && (
              <div className="text-sm text-success">
                Score submitted successfully!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
