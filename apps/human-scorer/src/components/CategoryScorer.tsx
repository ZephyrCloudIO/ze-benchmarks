import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CategoryScorerProps {
  category: string;
  score: number;
  confidence: number;
  reasoning: string;
  onScoreChange: (score: number) => void;
  onConfidenceChange: (confidence: number) => void;
  onReasoningChange: (reasoning: string) => void;
  llmScore?: {
    score: number;
    maxScore: number;
    details?: string;
  };
}

export function CategoryScorer({
  category,
  score,
  confidence,
  reasoning,
  onScoreChange,
  onConfidenceChange,
  onReasoningChange,
  llmScore,
}: CategoryScorerProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{category}</CardTitle>
          {llmScore && (
            <Badge variant="outline" className="text-xs">
              LLM: {llmScore.score}/{llmScore.maxScore}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Selection (1-5) */}
        <div className="space-y-2">
          <Label>Score</Label>
          <RadioGroup
            value={score.toString()}
            onValueChange={(val) => onScoreChange(parseInt(val))}
            className="flex gap-4"
          >
            {[1, 2, 3, 4, 5].map((val) => (
              <div key={val} className="flex items-center space-x-2">
                <RadioGroupItem value={val.toString()} id={`${category}-${val}`} />
                <Label
                  htmlFor={`${category}-${val}`}
                  className="cursor-pointer font-normal"
                >
                  {val}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Poor</span>
            <span>Perfect</span>
          </div>
        </div>

        {/* Confidence Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Confidence</Label>
            <span className="text-sm font-medium">{confidence}%</span>
          </div>
          <Slider
            value={[confidence]}
            onValueChange={(vals) => onConfidenceChange(vals[0])}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
        </div>

        {/* Reasoning Textarea */}
        <div className="space-y-2">
          <Label htmlFor={`reasoning-${category}`}>
            Reasoning (optional)
          </Label>
          <Textarea
            id={`reasoning-${category}`}
            value={reasoning}
            onChange={(e) => onReasoningChange(e.target.value)}
            placeholder="Explain your score..."
            className="min-h-[80px]"
          />
        </div>

        {/* LLM Details (if available) */}
        {llmScore?.details && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              LLM Reasoning
            </summary>
            <div className="mt-2 p-2 bg-muted rounded-md">
              <pre className="whitespace-pre-wrap">{llmScore.details}</pre>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
