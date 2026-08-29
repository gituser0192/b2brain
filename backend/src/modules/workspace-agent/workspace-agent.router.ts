export type WorkspaceAgentIntent =
  | "DAILY_BRIEF"
  | "GOAL_CREATE"
  | "GOAL_LIST"
  | "NEW_CUSTOMERS"
  | "OVERDUE_WORK"
  | "CUSTOMER_CREATE"
  | "CUSTOMER_COUNT"
  | "BUSINESS_HEALTH"
  | "FINANCE_SUMMARY"
  | "FORECAST"
  | "PRODUCT_HELP"
  | "SETUP_GUIDANCE"
  | "HUMAN_ESCALATION"
  | "CONVERSATIONAL_FALLBACK";

export type ProcessingPath =
  | "DETERMINISTIC_TOOL"
  | "PRODUCT_HELP"
  | "WRITE_ACTION"
  | "HUMAN_ESCALATION"
  | "DETERMINISTIC_FALLBACK";

export function routeWorkspaceRequest(message: string): {
  intent: WorkspaceAgentIntent;
  path: ProcessingPath;
  aiRequired: false;
} {
  const value = message.trim(),
    lower = value.toLowerCase();
  if (/(today[’']?s brief|daily brief|review today)/i.test(value))
    return {
      intent: "DAILY_BRIEF",
      path: "DETERMINISTIC_TOOL",
      aiRequired: false,
    };
  if (
    /(?:create|add|set).*(?:measurable )?goal|(?:measurable )?goal.*(?:create|add|set)/i.test(
      value,
    )
  )
    return { intent: "GOAL_CREATE", path: "WRITE_ACTION", aiRequired: false };
  if (/^(?:show |review |open )?(?:my |business )?goals[.!?\s]*$/i.test(value))
    return {
      intent: "GOAL_LIST",
      path: "DETERMINISTIC_TOOL",
      aiRequired: false,
    };
  if (/(new customers?|new leads?)/i.test(value))
    return {
      intent: "NEW_CUSTOMERS",
      path: "DETERMINISTIC_TOOL",
      aiRequired: false,
    };
  if (
    /(overdue.*(?:follow[- ]?ups?|tasks?)|(?:follow[- ]?ups?|tasks?).*overdue)/i.test(
      value,
    )
  )
    return {
      intent: "OVERDUE_WORK",
      path: "DETERMINISTIC_TOOL",
      aiRequired: false,
    };
  if (
    /add\s+.+(?:phone|\d{7,}).*(?:crm|customer)|add\s+.+\d{7,}|crm.*\d{7,}.*add/i.test(
      value,
    )
  )
    return {
      intent: "CUSTOMER_CREATE",
      path: "WRITE_ACTION",
      aiRequired: false,
    };
  if (
    /(?:count|total|how many|number of|kitne).*(?:customer|client)|(?:customer|client).*(?:count|total|how many|number of|kitne)/i.test(
      value,
    )
  )
    return {
      intent: "CUSTOMER_COUNT",
      path: "DETERMINISTIC_TOOL",
      aiRequired: false,
    };
  if (/(business health|what is going on|what should i improve)/i.test(value))
    return {
      intent: "BUSINESS_HEALTH",
      path: "DETERMINISTIC_TOOL",
      aiRequired: false,
    };
  if (/(predict|forecast|next month)/i.test(value))
    return {
      intent: "FORECAST",
      path: "DETERMINISTIC_TOOL",
      aiRequired: false,
    };
  if (/(financial score|revenue|expense|profit)/i.test(value))
    return {
      intent: "FINANCE_SUMMARY",
      path: "DETERMINISTIC_TOOL",
      aiRequired: false,
    };
  if (
    /(how do i add a customer|how.*crm|kaise.*crm|crm.*kaise|explain b2|what can b2)/i.test(
      value,
    )
  )
    return { intent: "PRODUCT_HELP", path: "PRODUCT_HELP", aiRequired: false };
  if (
    /(help me set up|agent setup|set up my business agent|setup.*help|setup.*madad)/i.test(
      value,
    )
  )
    return {
      intent: "SETUP_GUIDANCE",
      path: "PRODUCT_HELP",
      aiRequired: false,
    };
  if (
    /(delete|refund|payment reversal|legal|credential|security problem|another organization|organization b|other company|private internal|ignore previous|system prompt|secret)/i.test(
      lower,
    )
  )
    return {
      intent: "HUMAN_ESCALATION",
      path: "HUMAN_ESCALATION",
      aiRequired: false,
    };
  return {
    intent: "CONVERSATIONAL_FALLBACK",
    path: "DETERMINISTIC_FALLBACK",
    aiRequired: false,
  };
}
