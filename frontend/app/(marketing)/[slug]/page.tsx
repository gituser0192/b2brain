import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const pages = {
  services: {
    eyebrow: "Services",
    title: "One workspace, shaped around your business.",
    intro:
      "Enable only the services your organization needs. Availability and permissions remain explicit for every user.",
    sections: [
      [
        "Customer growth",
        "Leads, inquiries, CRM follow-ups, sales pipelines and customer context.",
      ],
      [
        "Work delivery",
        "Projects, tasks, calendars and accountable team execution.",
      ],
      [
        "Money",
        "Revenue, expenses, invoices, collections and explainable financial health.",
      ],
      [
        "People",
        "Employee records kept separate from login accounts and workspace membership.",
      ],
      [
        "Intelligence",
        "Business analysis, daily operating briefs, priorities and safe Agent tools.",
      ],
      [
        "Automation",
        "Website enquiries, test-mode channels, approvals and traceable activity.",
      ],
    ],
  },
  "why-sathos": {
    eyebrow: "Why SATHOS",
    title: "Your business should not live across disconnected tabs.",
    intro:
      "SATHOS creates a shared operating picture without pretending every business works the same way.",
    sections: [
      [
        "One source of operating context",
        "Customers, work, money and priorities stay connected to the organization that owns them.",
      ],
      [
        "Clear responsibility",
        "Roles and permissions control who can view, manage or approve sensitive work.",
      ],
      [
        "Useful intelligence",
        "Assessments explain their period, sources and limitations instead of hiding behind a score.",
      ],
      [
        "Technology with restraint",
        "Automation and Agent actions remain bounded, reviewable and truthful about what is live.",
      ],
    ],
  },
  "how-it-works": {
    eyebrow: "How it works",
    title: "From first conversation to an operating workspace.",
    intro: "SATHOS is currently offered through a guided private-beta setup.",
    sections: [
      [
        "1. Request access",
        "Tell us about the business, team and workflows you want to improve.",
      ],
      [
        "2. Workspace review",
        "A SATHOS executive reviews the request and confirms the right services and access model.",
      ],
      [
        "3. Guided setup",
        "We configure the approved workspace without inventing sample business records.",
      ],
      [
        "4. Start operating",
        "Your team signs in with its own permissions and grows into additional services when ready.",
      ],
    ],
  },
  security: {
    eyebrow: "Security",
    title: "Business access should be deliberate, not assumed.",
    intro:
      "SATHOS is designed around organization isolation, permission checks and explicit confirmation for controlled actions.",
    sections: [
      [
        "Organization isolation",
        "Authenticated organization context—not browser input—determines access to business records.",
      ],
      [
        "Permission-aware services",
        "Enabled services and user permissions are rechecked at protected boundaries.",
      ],
      [
        "Controlled actions",
        "Sensitive Agent actions require a scoped, expiring confirmation before execution.",
      ],
      [
        "Truthful integrations",
        "Simulator, Test Mode, Draft and live states remain visibly distinct.",
      ],
      [
        "Responsible launch",
        "Security controls reduce risk, but no online system can promise absolute security.",
      ],
    ],
  },
  pricing: {
    eyebrow: "Pricing",
    title: "A plan should match the work you actually need.",
    intro:
      "Private-beta pricing is prepared after a short workspace review. We do not publish invented discounts or unavailable plans.",
    sections: [
      [
        "Workspace foundation",
        "Secure organization access, team permissions and the shared operating shell.",
      ],
      [
        "Business services",
        "Choose from available customer, work, finance, people and intelligence modules.",
      ],
      [
        "Guided implementation",
        "Setup scope depends on your data, workflows and integration requirements.",
      ],
      [
        "Request a proposal",
        "Contact us for a clear scope before any payment or activation.",
      ],
    ],
  },
  contact: {
    eyebrow: "Contact",
    title: "Tell us what your business needs to run better.",
    intro:
      "We are onboarding private-beta organizations through a guided review.",
    sections: [
      ["Email", "sathsupport@sathos.in"],
      [
        "What to include",
        "Your organization name, team size, current tools and the main workflow you want to improve.",
      ],
      [
        "What happens next",
        "A SATHOS executive reviews the request and contacts you about fit, setup and access. Sending an email does not automatically create or approve an account.",
      ],
    ],
  },
  privacy: {
    eyebrow: "Legal",
    title: "Privacy notice",
    intro:
      "This concise beta notice explains the current product position and is not a substitute for jurisdiction-specific legal review.",
    sections: [
      [
        "Information we process",
        "Account, organization and business workflow information required to provide enabled services.",
      ],
      [
        "How it is used",
        "To operate, secure, support and improve the SATHOS workspace and requested integrations.",
      ],
      [
        "Access and retention",
        "Access is permission-controlled. Retention requirements will be documented before public launch.",
      ],
      ["Contact", "Send privacy questions to sathsupport@sathos.in."],
    ],
  },
  terms: {
    eyebrow: "Legal",
    title: "Private-beta terms",
    intro:
      "These launch notes must be reviewed by a qualified legal professional before accepting public customers or payments.",
    sections: [
      [
        "Beta availability",
        "Features may change and Test Mode functionality must not be treated as a live external connection.",
      ],
      [
        "Authorized use",
        "Customers are responsible for authorized users, lawful data and permitted use of connected services.",
      ],
      [
        "Human review",
        "Automated and Agent-assisted outputs require appropriate business judgment and confirmation.",
      ],
      [
        "Commercial terms",
        "Pricing, refunds, service levels and liability terms will be agreed before paid activation.",
      ],
    ],
  },
} as const;

type Slug = keyof typeof pages;
const serviceDetails = [
  {
    title: "Customers and sales",
    need: "For teams losing enquiries, callbacks or deal context across calls, messages and spreadsheets.",
    includes: [
      "Customer profiles and activity",
      "Lead ownership and sales stages",
      "Follow-ups, quotations and next actions",
    ],
    result:
      "A visible path from first enquiry to an accountable customer relationship.",
  },
  {
    title: "Projects and daily work",
    need: "For businesses that need clearer ownership after a sale or customer commitment.",
    includes: [
      "Projects, tasks and deadlines",
      "Assignments and delivery status",
      "Overdue-work visibility",
    ],
    result:
      "Work moves with named responsibility instead of depending on repeated status checks.",
  },
  {
    title: "Finance and collections",
    need: "For owners who need an operational view of money without inventing accounting data.",
    includes: [
      "Revenue and expense records",
      "Invoices and payment collections",
      "Financial summaries and health factors",
    ],
    result:
      "Teams can connect delivery and customer activity with the financial records they maintain.",
  },
  {
    title: "People and access",
    need: "For growing teams that need employee records and application access to remain clearly separated.",
    includes: [
      "Employee directory and status",
      "Workspace membership",
      "Roles and permission-aware access",
    ],
    result:
      "The right people see the right services without treating every employee as a login account.",
  },
  {
    title: "Automation and connections",
    need: "For teams repeating intake, follow-up and approval work across channels.",
    includes: [
      "Website enquiry and order intake",
      "Test Mode channel setup",
      "Approvals and bounded activity history",
    ],
    result:
      "Repetitive workflows become traceable while simulator, draft, Test Mode and live states remain distinct.",
  },
  {
    title: "Business intelligence",
    need: "For owners who need priorities and explanations grounded in current business records.",
    includes: [
      "Business health assessment",
      "Daily operating brief",
      "Permission-aware Ask SATHOS tools",
    ],
    result:
      "Decision support links back to permitted sources and never turns unavailable information into a verified zero.",
  },
] as const;

const whyProblems = [
  [
    "Information is scattered",
    "Customer notes, tasks, money and decisions live in different tools, chats and spreadsheets.",
  ],
  [
    "Ownership is unclear",
    "People know the work exists, but not who owns the next action or when it is due.",
  ],
  [
    "Reports arrive too late",
    "Owners learn about stalled follow-ups, delayed work or collection risk after it has already grown.",
  ],
  [
    "Automation feels risky",
    "Teams want repetitive work reduced without losing approval, visibility or human judgment.",
  ],
] as const;

const whyDifferences = [
  [
    "Another isolated application",
    "Services share organization context inside one permission-aware workspace.",
  ],
  [
    "A dashboard full of unexplained numbers",
    "Important facts show their source, period and availability.",
  ],
  [
    "Automation that silently acts",
    "Controlled actions remain previewed, confirmed and traceable.",
  ],
  [
    "Every feature enabled for everyone",
    "Organizations enable relevant services and users receive role-appropriate access.",
  ],
] as const;

const onboardingSteps = [
  {
    title: "Request a workspace review",
    summary: "Tell us who you are and where work currently becomes difficult.",
    customer:
      "Share your organization, team size, current tools and the workflow you most want to improve.",
    sathos:
      "We review the request for fit and contact you. A request does not automatically create or approve an account.",
  },
  {
    title: "Define the first operating scope",
    summary:
      "Choose a useful starting point instead of enabling everything at once.",
    customer:
      "Identify responsible people, required records and the service areas that matter now.",
    sathos:
      "We agree the initial services, access model and any Test Mode limitations before setup.",
  },
  {
    title: "Prepare the workspace",
    summary:
      "Configure a clean organization workspace around real responsibilities.",
    customer:
      "Confirm membership, roles and the information your team is ready to maintain.",
    sathos:
      "We configure approved services and explain permissions without inventing sample business records.",
  },
  {
    title: "Learn the working routine",
    summary: "Start with a small, repeatable process your team can follow.",
    customer:
      "Use the workspace for the agreed customer, work or finance workflow.",
    sathos:
      "We guide the team through the relevant views, states and confirmation boundaries.",
  },
  {
    title: "Expand from evidence",
    summary: "Add services only after the foundation is useful and understood.",
    customer:
      "Review what is working, what remains manual and where clearer ownership is needed.",
    sathos:
      "We help assess the next service or connection without presenting unavailable functionality as live.",
  },
] as const;

const securityLayers = [
  [
    "Organization boundaries",
    "Business records are resolved from the authenticated organization context rather than an organization identifier supplied by the browser.",
  ],
  [
    "Service and role checks",
    "A service must be enabled for the organization and the signed-in user must hold the required permission.",
  ],
  [
    "Controlled Agent actions",
    "Supported write actions show a scoped preview and require an expiring confirmation before execution.",
  ],
  [
    "Connector credential handling",
    "Connection secrets belong in protected server-side configuration paths and are never displayed back in the customer interface.",
  ],
  [
    "Truthful connection states",
    "Simulator, Test Mode, Draft, disconnected and live states remain distinct so testing cannot be mistaken for delivery.",
  ],
  [
    "Bounded business access",
    "Agent and workspace queries use validated inputs, bounded results and the same organization and permission checks as the underlying service.",
  ],
] as const;

const pricingFactors = [
  [
    "Services selected",
    "The customer, work, finance, people, intelligence and automation areas included in the first rollout.",
  ],
  [
    "Team and access scope",
    "The number and types of users, roles and permission setup required for the organization.",
  ],
  [
    "Setup complexity",
    "The workflows, existing records and configuration work needed to prepare a useful workspace.",
  ],
  [
    "Connection requirements",
    "Any approved channel or integration setup, including whether it is Test Mode or genuinely available for live use.",
  ],
  [
    "Guidance and support",
    "The onboarding, training and ongoing assistance agreed for the rollout.",
  ],
  [
    "Future expansion",
    "Additional services are scoped separately when the organization is ready; they are not silently added to the first proposal.",
  ],
] as const;

const contactReasons = [
  ["Private-beta access", "Tell us what your organization does, your approximate team size and the first workflow you want to improve.", "SATHOS private beta request"],
  ["Existing workspace support", "Include the workspace name, the page or service involved and a clear description of the problem. Do not send passwords or tokens.", "SATHOS workspace support"],
  ["Security or privacy question", "Describe the concern without including credentials, private customer records or sensitive configuration values.", "SATHOS security and privacy question"],
] as const;

const privacyTopics = [
  ["Account and organization information", "Names, work email addresses, organization details, membership, roles and authentication-related records needed to provide access."],
  ["Business workspace information", "Records entered into enabled services, such as customers, leads, projects, tasks, finance records, employees, approvals and activity."],
  ["Support communications", "Information you choose to include when requesting access, asking a question or reporting a problem."],
  ["Security and technical information", "Session, request, audit and diagnostic information used to operate, protect and troubleshoot the service."],
] as const;

const privacyUses = [
  ["Provide the workspace", "Authenticate users, enforce organization boundaries and operate enabled services."],
  ["Protect the service", "Investigate suspicious activity, maintain auditability and enforce permissions."],
  ["Support customers", "Respond to access requests, service questions and reported problems."],
  ["Improve reliability", "Understand failures and improve the product without presenting missing information as verified business data."],
] as const;

const betaTerms = [
  ["Private-beta availability", "Features may change, remain incomplete or be withdrawn. Beta, Test Mode, Simulator and Draft functionality must not be treated as a verified live external service."],
  ["Authorized accounts", "Organizations are responsible for invited users, suitable role assignments, account security and promptly removing access that is no longer required."],
  ["Lawful business information", "Customers must have the authority and lawful basis needed to enter, manage and use business, employee and customer information in the workspace."],
  ["Human judgment", "Dashboards, assessments, Agent responses and suggested actions support decisions; they do not replace professional, financial, legal or operational judgment."],
  ["Controlled automation", "Customers must review connection states and confirmation details. Test activity, drafts and simulations do not prove that an external message or action was delivered."],
  ["Acceptable use", "The workspace must not be used to gain unauthorized access, interfere with the service, distribute unlawful content or misuse another organization’s information."],
] as const;

const unresolvedTerms = [
  "Final subscription, tax and payment terms",
  "Cancellation, renewal and refund rules",
  "Service levels, maintenance and support commitments",
  "Data retention, export and deletion periods",
  "Warranty, indemnity and liability provisions",
  "Governing law and dispute-resolution terms",
] as const;

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = pages[slug as Slug];
  return page ? { title: page.eyebrow, description: page.intro, alternates: { canonical: `/${slug}` } } : {};
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = pages[slug as Slug];
  if (!page) notFound();
  return (
    <>
      <section className="site-page-hero">
        <span className="site-kicker">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
        {slug === "contact" && (
          <a
            className="site-button"
            href="mailto:sathsupport@sathos.in?subject=SATHOS%20private%20beta%20request"
          >
            Email SATHOS support
          </a>
        )}
      </section>
      {slug === "services" ? (
        <>
          <section className="site-service-intro">
            <div>
              <span className="site-kicker">Built around business needs</span>
              <h2>Start with the problem, not the software.</h2>
            </div>
            <p>
              SATHOS services share organization context but remain separately
              enabled and permission-controlled. Begin with the areas creating
              the most friction, then expand when your process and team are
              ready.
            </p>
          </section>
          <section
            className="site-service-directory"
            aria-label="SATHOS service directory"
          >
            {serviceDetails.map((service, index) => (
              <article key={service.title}>
                <header>
                  <span>0{index + 1}</span>
                  <div>
                    <h2>{service.title}</h2>
                    <p>{service.need}</p>
                  </div>
                </header>
                <div>
                  <h3>What it brings together</h3>
                  <ul>
                    {service.includes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>What improves</h3>
                  <p>{service.result}</p>
                </div>
              </article>
            ))}
          </section>
          <section className="site-service-note">
            <div>
              <span className="site-kicker">Clear availability</span>
              <h2>Enabled does not automatically mean live.</h2>
            </div>
            <p>
              Service access, product maturity and external connection status
              are different things. Your workspace labels Beta, Test Mode,
              Simulator, Draft and live states separately so your team knows
              what is actually available.
            </p>
            <Link className="site-text-link" href="/how-it-works">
              See the guided setup process →
            </Link>
          </section>
        </>
      ) : slug === "why-sathos" ? (
        <>
          <section className="site-why-problems">
            <header>
              <span className="site-kicker">The operating gap</span>
              <h2>
                Growth creates coordination problems before it creates clarity.
              </h2>
              <p>
                Most teams do not lack effort. They lack one dependable view of
                customers, commitments, money and priorities.
              </p>
            </header>
            <div>
              {whyProblems.map(([title, copy], index) => (
                <article key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="site-why-difference">
            <header>
              <span className="site-kicker">A different approach</span>
              <h2>Connected where it helps. Controlled where it matters.</h2>
            </header>
            <div
              className="site-comparison"
              role="table"
              aria-label="How SATHOS differs"
            >
              <div className="site-comparison-head" role="row">
                <span role="columnheader">Instead of</span>
                <span role="columnheader">SATHOS provides</span>
              </div>
              {whyDifferences.map(([before, after]) => (
                <div role="row" key={before}>
                  <span role="cell">{before}</span>
                  <strong role="cell">{after}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="site-why-principles">
            <header>
              <span className="site-kicker">Product principles</span>
              <h2>Useful software should be understandable.</h2>
            </header>
            <div>
              {page.sections.map(([title, copy]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="site-why-fit">
            <div>
              <span className="site-kicker">A good fit when</span>
              <h2>Your team is ready to establish shared ownership.</h2>
              <p>
                SATHOS works best when the organization wants consistent
                records, named responsibility and a guided rollout around real
                workflows.
              </p>
            </div>
            <div>
              <span className="site-kicker">Not a shortcut for</span>
              <h2>Missing process or unattended decisions.</h2>
              <p>
                The platform cannot replace business judgment, guarantee
                outcomes or make incomplete data reliable. Automation and Agent
                assistance still need accountable people.
              </p>
            </div>
          </section>
        </>
      ) : slug === "how-it-works" ? (
        <>
          <section className="site-onboarding-intro">
            <div>
              <span className="site-kicker">Guided private beta</span>
              <h2>A practical rollout, one useful workflow at a time.</h2>
            </div>
            <p>
              There is no instant activation or automatic approval during the
              private beta. We first confirm fit, scope and responsibility so
              your workspace begins with a process the team can actually
              maintain.
            </p>
          </section>
          <section
            className="site-onboarding-steps"
            aria-label="SATHOS onboarding journey"
          >
            {onboardingSteps.map((step, index) => (
              <article key={step.title}>
                <span>{index + 1}</span>
                <header>
                  <h2>{step.title}</h2>
                  <p>{step.summary}</p>
                </header>
                <div>
                  <h3>Your part</h3>
                  <p>{step.customer}</p>
                </div>
                <div>
                  <h3>Our part</h3>
                  <p>{step.sathos}</p>
                </div>
              </article>
            ))}
          </section>
          <section className="site-onboarding-ready">
            <div>
              <span className="site-kicker">Prepare for the review</span>
              <h2>What helps us understand your business.</h2>
              <ul>
                <li>The workflow creating the most friction</li>
                <li>The people responsible for that work</li>
                <li>The tools and records already in use</li>
                <li>The result you want to improve first</li>
              </ul>
            </div>
            <aside>
              <span className="site-kicker">What you do not need</span>
              <h2>Credentials or sensitive access details.</h2>
              <p>
                Do not email passwords, one-time codes, access tokens, app
                secrets, encryption keys or webhook secrets. Connection
                credentials belong only in an approved secure setup flow.
              </p>
            </aside>
          </section>
        </>
      ) : slug === "security" ? (
        <>
          <section className="site-security-intro">
            <div>
              <span className="site-kicker">Security by boundaries</span>
              <h2>Access follows identity, organization and responsibility.</h2>
            </div>
            <p>
              SATHOS uses layered checks rather than trusting a page, link or
              browser-supplied identifier. Protected operations are evaluated
              against authenticated context and the underlying service rules.
            </p>
          </section>
          <section
            className="site-security-layers"
            aria-label="SATHOS security layers"
          >
            {securityLayers.map(([title, copy], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2>{title}</h2>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </section>
          <section className="site-security-shared">
            <div>
              <span className="site-kicker">SATHOS responsibility</span>
              <h2>Protect platform boundaries.</h2>
              <ul>
                <li>Authorize access at protected backend operations</li>
                <li>Keep organization records separated</li>
                <li>
                  Use explicit confirmation for supported sensitive actions
                </li>
                <li>
                  Describe unavailable and Test Mode capabilities truthfully
                </li>
              </ul>
            </div>
            <div>
              <span className="site-kicker">Customer responsibility</span>
              <h2>Protect people and business use.</h2>
              <ul>
                <li>Invite only authorized team members</li>
                <li>Assign the minimum permissions each role needs</li>
                <li>Review confirmations and connected-service states</li>
                <li>Report suspected account or access problems promptly</li>
              </ul>
            </div>
          </section>
          <section className="site-security-notice">
            <div>
              <span className="site-kicker">Safe communication</span>
              <h2>We will not ask you to email sensitive credentials.</h2>
              <p>
                Never send passwords, OTPs, access tokens, app secrets,
                encryption keys, webhook secrets or full database connection
                strings by email.
              </p>
            </div>
            <aside>
              <h3>Responsible statement</h3>
              <p>
                No internet service can promise absolute security. Controls
                reduce risk, while secure customer practices, monitoring and
                continued review remain necessary.
              </p>
              <a href="mailto:sathsupport@sathos.in?subject=SATHOS%20security%20question">
                Ask a security question →
              </a>
            </aside>
          </section>
        </>
      ) : slug === "pricing" ? (
        <>
          <section className="site-pricing-intro">
            <div>
              <span className="site-kicker">Pricing built around scope</span>
              <h2>No fixed package before we understand the work.</h2>
            </div>
            <p>
              Every organization begins with different services, team
              responsibilities and setup needs. During private beta, SATHOS
              prepares a written proposal only after a workspace review—before
              payment or activation.
            </p>
          </section>
          <section
            className="site-pricing-factors"
            aria-label="SATHOS pricing factors"
          >
            {pricingFactors.map(([title, copy], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2>{title}</h2>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </section>
          <section className="site-pricing-process">
            <header>
              <span className="site-kicker">
                From conversation to proposal
              </span>
              <h2>A transparent process before you commit.</h2>
            </header>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <h3>Tell us what needs improvement</h3>
                  <p>
                    Share your organization, team and priority workflow—without
                    sending credentials or sensitive access details.
                  </p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <h3>Review the recommended scope</h3>
                  <p>
                    We identify the services, setup work and known limitations
                    relevant to the first rollout.
                  </p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <h3>Receive a written proposal</h3>
                  <p>
                    The proposal explains the agreed scope and commercial
                    terms. Nothing is charged from the public website.
                  </p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <h3>Approve before activation</h3>
                  <p>
                    Your organization proceeds only after the proposal and
                    onboarding steps are accepted.
                  </p>
                </div>
              </li>
            </ol>
          </section>
          <section className="site-pricing-clarity">
            <div>
              <span className="site-kicker">
                Included in the conversation
              </span>
              <h2>Clear scope, status and expectations.</h2>
              <ul>
                <li>Which services are part of the rollout</li>
                <li>Which capabilities are Available, Beta or Test Mode</li>
                <li>Who needs access and what setup is required</li>
                <li>What guidance and support are included</li>
              </ul>
            </div>
            <aside>
              <span className="site-kicker">No surprise claims</span>
              <h2>What this page does not promise.</h2>
              <p>
                No invented “starting from” price, fake discount, unlimited-use
                promise or automatic account approval. Pricing, taxes, payment
                terms, cancellation and support scope must appear in the written
                proposal.
              </p>
            </aside>
          </section>
        </>
      ) : slug === "contact" ? (
        <>
          <section className="site-contact-primary">
            <div>
              <span className="site-kicker">One clear contact</span>
              <h2>Start with an email to our team.</h2>
              <p>
                Use the address below for private-beta requests, workspace
                support and security or privacy questions. Choose a clear
                subject so we can understand the request before replying.
              </p>
              <a
                className="site-contact-email"
                href="mailto:sathsupport@sathos.in"
              >
                sathsupport@sathos.in
              </a>
            </div>
            <aside>
              <span className="site-kicker">Before you send</span>
              <h2>Useful context, not sensitive access.</h2>
              <ul>
                <li>Your name and organization</li>
                <li>The service or workflow involved</li>
                <li>What you expected and what happened</li>
                <li>A safe way and suitable time to contact you</li>
              </ul>
            </aside>
          </section>
          <section className="site-contact-reasons" aria-label="Contact SATHOS">
            <header>
              <span className="site-kicker">Choose your reason</span>
              <h2>Help us route your message correctly.</h2>
            </header>
            <div>
              {contactReasons.map(([title, copy, subject]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <a
                    href={`mailto:sathsupport@sathos.in?subject=${encodeURIComponent(subject)}`}
                  >
                    Compose email →
                  </a>
                </article>
              ))}
            </div>
          </section>
          <section className="site-contact-next">
            <header>
              <span className="site-kicker">What happens next</span>
              <h2>A human reviews the request.</h2>
            </header>
            <ol>
              <li>
                <span>1</span>
                <p>We read the context and identify the relevant request.</p>
              </li>
              <li>
                <span>2</span>
                <p>
                  We may ask focused follow-up questions before proposing a
                  workspace review or support step.
                </p>
              </li>
              <li>
                <span>3</span>
                <p>
                  Access, commercial scope and activation remain separate
                  decisions; sending an email does not approve an account.
                </p>
              </li>
            </ol>
            <p className="site-contact-warning">
              Never email passwords, OTPs, access tokens, app secrets,
              encryption keys, webhook secrets or database connection strings.
            </p>
          </section>
        </>
      ) : slug === "privacy" ? (
        <>
          <section className="site-privacy-intro">
            <div>
              <span className="site-kicker">Private-beta notice</span>
              <h2>A readable explanation of the current product position.</h2>
            </div>
            <div>
              <p>
                This page explains how the private-beta workspace is designed
                to handle information. It is not the final jurisdiction-specific
                legal notice and must be reviewed by qualified counsel before a
                public or paid launch.
              </p>
              <strong>Last reviewed: 21 September 2026</strong>
            </div>
          </section>
          <section className="site-privacy-topics" aria-label="Information processed by SATHOS">
            <header>
              <span className="site-kicker">Information categories</span>
              <h2>Information needed to operate the workspace.</h2>
            </header>
            <div>
              {privacyTopics.map(([title, copy]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="site-privacy-uses">
            <header>
              <span className="site-kicker">Why it is used</span>
              <h2>Purpose should remain connected to the service.</h2>
            </header>
            <div>
              {privacyUses.map(([title, copy], index) => (
                <article key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="site-privacy-controls">
            <div>
              <span className="site-kicker">Access and responsibility</span>
              <h2>Workspace access follows the organization.</h2>
              <p>
                Authenticated organization context, enabled services and user
                permissions determine access. Customer organizations remain
                responsible for lawful collection, accurate records and
                appropriate access assignments for their users.
              </p>
            </div>
            <div>
              <span className="site-kicker">Retention and requests</span>
              <h2>Final periods must be documented before launch.</h2>
              <p>
                Retention, deletion, legal-request and cross-border processing
                terms require formal review and must not be inferred from this
                beta notice. Send current privacy questions or requests to the
                address below.
              </p>
              <a href="mailto:sathsupport@sathos.in?subject=SATHOS%20privacy%20request">
                sathsupport@sathos.in →
              </a>
            </div>
          </section>
          <section className="site-privacy-caution">
            <strong>Do not send sensitive credentials by email.</strong>
            <p>
              Never include passwords, OTPs, access tokens, app secrets,
              encryption keys, webhook secrets or database connection strings
              in a privacy or support message.
            </p>
          </section>
        </>
      ) : slug === "terms" ? (
        <>
          <section className="site-terms-intro">
            <div>
              <span className="site-kicker">Private-beta framework</span>
              <h2>Plain-language expectations for responsible testing.</h2>
            </div>
            <div>
              <p>
                These notes describe the intended private-beta relationship.
                They are not final commercial terms and must be reviewed by
                qualified legal counsel before public customers, automated
                acceptance or payments are introduced.
              </p>
              <strong>Last reviewed: 21 September 2026</strong>
            </div>
          </section>
          <section className="site-terms-rules" aria-label="SATHOS private beta terms">
            <header>
              <span className="site-kicker">Current expectations</span>
              <h2>Use the workspace with clear authority and human oversight.</h2>
            </header>
            <div>
              {betaTerms.map(([title, copy], index) => (
                <article key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="site-terms-boundaries">
            <div>
              <span className="site-kicker">Product boundaries</span>
              <h2>What private-beta access does not mean.</h2>
              <ul>
                <li>No guarantee that every service or integration is available</li>
                <li>No promise of uninterrupted or error-free operation</li>
                <li>No unattended reliance on Agent or automated output</li>
                <li>No authority to process information you do not lawfully control</li>
              </ul>
            </div>
            <aside>
              <span className="site-kicker">Account action</span>
              <h2>Access may need to be limited for safety.</h2>
              <p>
                Suspected misuse, unauthorized access, security risk or unlawful
                activity may require access restriction while the issue is
                reviewed. Final suspension and termination rights must be stated
                in the approved customer agreement.
              </p>
            </aside>
          </section>
          <section className="site-terms-open">
            <header>
              <span className="site-kicker">Required before paid launch</span>
              <h2>Commercial and legal terms still to be finalized.</h2>
              <p>
                These subjects must be agreed in a reviewed written contract;
                this page does not silently decide them.
              </p>
            </header>
            <ul>
              {unresolvedTerms.map((term) => <li key={term}>{term}</li>)}
            </ul>
            <a href="mailto:sathsupport@sathos.in?subject=SATHOS%20terms%20question">
              Ask a terms question →
            </a>
          </section>
        </>
      ) : (
        <section className="site-page-grid">
          {page.sections.map(([title, copy]) => (
            <article key={title}>
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </section>
      )}
      <section className="site-page-close">
        <h2>Ready to explore SATHOS?</h2>
        <p>
          Request access for your organization or sign in to an approved
          workspace.
        </p>
        <div className="site-actions">
          <Link className="site-button" href="/contact">
            Request access
          </Link>
          <Link href="/login">Sign in →</Link>
        </div>
      </section>
    </>
  );
}
