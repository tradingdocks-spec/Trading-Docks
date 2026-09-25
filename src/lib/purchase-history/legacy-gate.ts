/** Permanent certification gate until these callers use the transactional
 * purchase/receipt command. Never controlled by a browser or environment flag. */
export function legacyAcquisitionWriteDecision() {
  return { allowed: false, code: "ACQUISITION_WORKFLOW_REQUIRED", message:
    "This purchase workflow is paused while acquisition integrity is verified. Use Collection Intake to record a reviewed purchase and receipt. Existing records are preserved." };
}
