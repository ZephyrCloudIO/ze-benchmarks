import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { HumanScore } from "@/lib/api-client";

interface HumanScoreDisplayProps {
  humanScores: HumanScore[];
}

export function HumanScoreDisplay({ humanScores }: HumanScoreDisplayProps) {
  if (humanScores.length === 0) {
    return null;
  }

  // Calculate aggregate statistics
  const avgOverallScore = humanScores.reduce((sum, hs) => sum + hs.overallScore, 0) / humanScores.length;
  const avgTimeSpent = humanScores
    .filter(hs => hs.timeSpentSeconds)
    .reduce((sum, hs) => sum + (hs.timeSpentSeconds || 0), 0) /
    humanScores.filter(hs => hs.timeSpentSeconds).length;

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Calculate average scores per category
  const categoryAverages = new Map<string, { sum: number; count: number; avgConfidence: number }>();
  humanScores.forEach(hs => {
    hs.scores.forEach(catScore => {
      const existing = categoryAverages.get(catScore.category) || { sum: 0, count: 0, avgConfidence: 0 };
      existing.sum += catScore.score;
      existing.count += 1;
      existing.avgConfidence += (catScore.confidence || 0);
      categoryAverages.set(catScore.category, existing);
    });
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Human Scores</CardTitle>
          <Badge variant="info">{humanScores.length} scorer{humanScores.length !== 1 ? 's' : ''}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aggregate Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted p-3 rounded-md">
            <div className="text-xs text-muted-foreground">Avg Overall Score</div>
            <div className="text-2xl font-bold">
              {((avgOverallScore * 4) + 1).toFixed(2)}/5
            </div>
            <div className="text-xs text-muted-foreground">
              Normalized: {avgOverallScore.toFixed(3)}
            </div>
          </div>
          {avgTimeSpent > 0 && (
            <div className="bg-muted p-3 rounded-md">
              <div className="text-xs text-muted-foreground">Avg Time Spent</div>
              <div className="text-2xl font-bold">{formatTime(Math.floor(avgTimeSpent))}</div>
            </div>
          )}
        </div>

        {/* Category Averages */}
        {categoryAverages.size > 0 && (
          <div>
            <h4 className="font-semibold mb-2 text-sm">Category Averages</h4>
            <div className="space-y-2">
              {Array.from(categoryAverages.entries()).map(([category, data]) => {
                const avgScore = data.sum / data.count;
                const avgConfidence = data.avgConfidence / data.count;
                return (
                  <div key={category} className="flex items-center justify-between p-2 bg-muted rounded-md">
                    <span className="text-sm">{category}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{avgScore.toFixed(1)}/5</span>
                      {avgConfidence > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {avgConfidence.toFixed(0)}% confidence
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Individual Human Scores */}
        <Accordion type="single" collapsible className="w-full">
          {humanScores.map((humanScore) => (
            <AccordionItem key={humanScore.id} value={`human-${humanScore.id}`}>
              <AccordionTrigger>
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{humanScore.scorerName}</span>
                    {humanScore.scorerEmail && (
                      <span className="text-xs text-muted-foreground">({humanScore.scorerEmail})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {((humanScore.overallScore * 4) + 1).toFixed(1)}/5
                    </Badge>
                    {humanScore.timeSpentSeconds && (
                      <span className="text-xs text-muted-foreground">
                        {formatTime(humanScore.timeSpentSeconds)}
                      </span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-4">
                  {/* Category Scores */}
                  <div className="space-y-2">
                    {humanScore.scores.map((catScore, idx) => (
                      <div key={idx} className="border-l-2 border-primary pl-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{catScore.category}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{catScore.score}/5</span>
                            {catScore.confidence !== undefined && (
                              <Badge variant="outline" className="text-xs">
                                {catScore.confidence}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        {catScore.reasoning && (
                          <p className="text-xs text-muted-foreground">{catScore.reasoning}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Notes */}
                  {humanScore.notes && (
                    <div className="bg-muted p-3 rounded-md">
                      <div className="text-xs font-semibold mb-1">Notes:</div>
                      <p className="text-xs text-muted-foreground">{humanScore.notes}</p>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-xs text-muted-foreground">
                    Scored at: {new Date(humanScore.createdAt).toLocaleString()}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
