/*
 * AI actions intentionally return a proposal.
 * Sensitive HRMS mutations must be approved and executed by the normal
 * application/backend authorization flow.
 */

export const AI_ACTIONS = {
  DRAFT: "draft",
  RECOMMEND: "recommend",
  PREPARE_REPORT: "prepare_report",
  PREPARE_LEAVE_SUMMARY: "prepare_leave_summary",
  PREPARE_PAYROLL_AUDIT: "prepare_payroll_audit",
  PREPARE_RECRUITMENT_SHORTLIST: "prepare_recruitment_shortlist",
};

export function createAIActionProposal({ type, title, description, payload = {} }) {
  return {
    id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    description,
    payload,
    status: "PENDING_HUMAN_REVIEW",
    createdAt: new Date().toISOString(),
  };
}

export function isSensitiveAIAction(type) {
  return [
    AI_ACTIONS.PREPARE_PAYROLL_AUDIT,
    AI_ACTIONS.PREPARE_LEAVE_SUMMARY,
    AI_ACTIONS.PREPARE_RECRUITMENT_SHORTLIST,
  ].includes(type);
}
