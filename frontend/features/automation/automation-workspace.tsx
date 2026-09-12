"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AgentManager } from "./agent-manager";
import { AgentRunCentre } from "./agent-run-centre";
import { AutomationOverview } from "./automation-overview";
import { BridgeManager } from "./bridge-manager";
import { FollowUpAutomationManager } from "./follow-up-automation-manager";
import { PolicyManager } from "./policy-manager";
import { CollectionScheduleManager } from "./collection-schedule-manager";
import { KnowledgeManager } from "./knowledge-manager";

const sections = ["overview", "connections", "automations", "approvals", "activity"] as const;
type AutomationSection = (typeof sections)[number];
const channels = ["whatsapp", "meta", "website", "email"] as const;
type AutomationChannel = (typeof channels)[number];

function sectionHref(section: AutomationSection) {
  return section === "overview" ? "/automation" : `/automation?section=${section}`;
}

export function AutomationWorkspace() {
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const section: AutomationSection = sections.includes(requestedSection as AutomationSection)
    ? requestedSection as AutomationSection
    : "overview";
  const requestedChannel = searchParams.get("channel");
  const channel: AutomationChannel | null = section === "connections" && channels.includes(requestedChannel as AutomationChannel)
    ? requestedChannel as AutomationChannel
    : null;

  return (
    <section className="automation-workspace">
      <header className="automation-header">
        <div>
          <p>Automation</p>
          <h2>Keep routine work moving.</h2>
          <span>Connect channels, control automated work, and review anything that needs you.</span>
        </div>
        <span className="automation-stage">Controlled workspace</span>
      </header>

      <nav className="automation-section-nav" aria-label="Automation sections">
        {sections.map((item) => (
          <Link key={item} href={sectionHref(item)} aria-current={section === item ? "page" : undefined}>
            {item[0].toUpperCase() + item.slice(1)}
          </Link>
        ))}
      </nav>

      <div className="automation-section" data-automation-section={section}>
        {section === "overview" && <AutomationOverview />}
        {section === "connections" && <BridgeManager view="connections" channel={channel} />}
        {section === "automations" && <>
          <AgentManager />
          {/* TODO: Move Business Knowledge to the Business Agent in a dedicated future phase. */}
          <KnowledgeManager />
          <CollectionScheduleManager />
          <PolicyManager />
          <FollowUpAutomationManager />
        </>}
        {section === "approvals" && <BridgeManager view="approvals" />}
        {section === "activity" && <><AgentRunCentre /><BridgeManager view="activity" /></>}
      </div>
    </section>
  );
}
