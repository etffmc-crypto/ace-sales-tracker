export type PipelineStage =
  | "PROSPECT"
  | "CONTACTED"
  | "QUOTED"
  | "ACTIVE_CUSTOMER"
  | "INACTIVE";

export const PIPELINE_ORDER: PipelineStage[] = [
  "PROSPECT",
  "CONTACTED",
  "QUOTED",
  "ACTIVE_CUSTOMER",
];

export function nextValidStages(current: PipelineStage): PipelineStage[] {
  if (current === "INACTIVE") {
    return PIPELINE_ORDER;
  }
  const idx = PIPELINE_ORDER.indexOf(current);
  const forward = PIPELINE_ORDER.slice(idx + 1);
  return [...forward, "INACTIVE"];
}
