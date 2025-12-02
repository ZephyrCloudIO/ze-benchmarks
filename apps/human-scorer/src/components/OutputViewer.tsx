import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { EvaluationResult } from "@/lib/api-client";

interface OutputViewerProps {
  runData: {
    suite: string;
    scenario: string;
    agent: string;
    model?: string;
    metadata?: string;
  };
  evaluations?: EvaluationResult[];
  telemetry?: {
    toolCalls?: number;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
    durationMs?: number;
    workspaceDir?: string;
    promptSent?: string;
  } | null;
}

export function OutputViewer({ runData, evaluations, telemetry }: OutputViewerProps) {
  // Parse metadata if available
  let metadata: any = {};
  try {
    metadata = runData.metadata ? JSON.parse(runData.metadata) : {};
  } catch (e) {
    // Ignore parse errors
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Benchmark Output</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="scenario" className="w-full">
          <TabsList>
            <TabsTrigger value="scenario">Scenario</TabsTrigger>
            <TabsTrigger value="response">Agent Response</TabsTrigger>
            <TabsTrigger value="llm-scores">LLM Scores</TabsTrigger>
            <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
          </TabsList>

          <TabsContent value="scenario" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                {runData.scenario}
              </h3>
              <div className="flex gap-2 mb-4">
                <Badge variant="secondary">{runData.suite}</Badge>
                <Badge variant="outline">{runData.agent}</Badge>
                {runData.model && <Badge variant="outline">{runData.model}</Badge>}
              </div>

              {metadata.description && (
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm">{metadata.description}</p>
                </div>
              )}

              {metadata.categories && Array.isArray(metadata.categories) && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2 text-sm">Evaluation Categories:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {metadata.categories.map((cat: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground">
                        {cat}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="response" className="space-y-4">
            {telemetry?.promptSent ? (
              <div>
                <h4 className="font-semibold mb-2 text-sm">Prompt Sent</h4>
                <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                  {telemetry.promptSent}
                </pre>
              </div>
            ) : (
              <div className="bg-muted p-4 rounded-md text-sm text-muted-foreground">
                Agent response not available. This will show the full agent output
                including commands executed and files modified.
              </div>
            )}
          </TabsContent>

          <TabsContent value="llm-scores" className="space-y-4">
            {evaluations && evaluations.length > 0 ? (
              <div className="space-y-2">
                {evaluations.map((evaluation) => (
                  <Card key={evaluation.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-sm">
                            {evaluation.evaluatorName}
                          </h4>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {evaluation.score} / {evaluation.maxScore}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {((evaluation.score / evaluation.maxScore) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                      {evaluation.details && (
                        <Accordion type="single" collapsible>
                          <AccordionItem value="details">
                            <AccordionTrigger>Details</AccordionTrigger>
                            <AccordionContent>
                              <pre className="text-xs whitespace-pre-wrap">
                                {evaluation.details}
                              </pre>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="bg-muted p-4 rounded-md text-sm text-muted-foreground">
                No LLM evaluations available for this run.
              </div>
            )}
          </TabsContent>

          <TabsContent value="telemetry" className="space-y-4">
            {telemetry ? (
              <div className="grid grid-cols-2 gap-4">
                {telemetry.toolCalls !== undefined && (
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-xs text-muted-foreground">Tool Calls</div>
                    <div className="text-lg font-semibold">{telemetry.toolCalls}</div>
                  </div>
                )}
                {telemetry.tokensIn !== undefined && (
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-xs text-muted-foreground">Tokens In</div>
                    <div className="text-lg font-semibold">
                      {telemetry.tokensIn.toLocaleString()}
                    </div>
                  </div>
                )}
                {telemetry.tokensOut !== undefined && (
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-xs text-muted-foreground">Tokens Out</div>
                    <div className="text-lg font-semibold">
                      {telemetry.tokensOut.toLocaleString()}
                    </div>
                  </div>
                )}
                {telemetry.costUsd !== undefined && (
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-xs text-muted-foreground">Cost</div>
                    <div className="text-lg font-semibold">
                      ${telemetry.costUsd.toFixed(4)}
                    </div>
                  </div>
                )}
                {telemetry.durationMs !== undefined && (
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-xs text-muted-foreground">Duration</div>
                    <div className="text-lg font-semibold">
                      {(telemetry.durationMs / 1000).toFixed(2)}s
                    </div>
                  </div>
                )}
                {telemetry.workspaceDir && (
                  <div className="bg-muted p-3 rounded-md col-span-2">
                    <div className="text-xs text-muted-foreground">Workspace</div>
                    <div className="text-sm font-mono">{telemetry.workspaceDir}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-muted p-4 rounded-md text-sm text-muted-foreground">
                No telemetry data available for this run.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
