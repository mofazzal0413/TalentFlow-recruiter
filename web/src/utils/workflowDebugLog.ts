import type { WorkflowStep } from "../types";
import { workflowStepToKey } from "../config/workflowStateMachine";

export function logWorkflowTransition(
  from: WorkflowStep | null,
  to: WorkflowStep,
  meta?: Record<string, unknown>,
) {
  if (!import.meta.env.DEV) return;

  const prefix = "[TalentFlow Workflow]";
  console.log(prefix, "Workflow step changed:", to, {
    from: from ? `${from} (${workflowStepToKey(from)})` : null,
    to: `${to} (${workflowStepToKey(to)})`,
    ...meta,
  });
}
