import type { Dispatch, SetStateAction } from "react";
import type { BridgeConnector } from "./bridge-types";

export type BridgeDialogKind =
  "connector" | "event" | "credentials" | "website-form" | "whatsapp-simulator";

export interface ConnectorForm {
  name: string;
  type: string;
  provider: string;
  externalAccountRef: string;
  status: string;
  mode: string;
}

export interface EventForm {
  externalEventId: string;
  eventName: string;
  kind: string;
  contactName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  raw: Record<string, never>;
}

export interface CredentialForm {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  appSecret: string;
}

export interface WebsiteForm {
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  accentColor: string;
  askService: boolean;
  serviceLabel: string;
}

export interface SimulatorForm {
  externalMessageId: string;
  from: string;
  contactName: string;
  message: string;
}

interface BridgeDialogsProps {
  open: BridgeDialogKind | null;
  connectors: BridgeConnector[];
  selected: string;
  connector: ConnectorForm;
  event: EventForm;
  credentials: CredentialForm;
  websiteForm: WebsiteForm;
  simulatorMessage: SimulatorForm;
  simulatorResult: string;
  setSelected: Dispatch<SetStateAction<string>>;
  setConnector: Dispatch<SetStateAction<ConnectorForm>>;
  setEvent: Dispatch<SetStateAction<EventForm>>;
  setCredentials: Dispatch<SetStateAction<CredentialForm>>;
  setWebsiteForm: Dispatch<SetStateAction<WebsiteForm>>;
  setSimulatorMessage: Dispatch<SetStateAction<SimulatorForm>>;
  onClose: () => void;
  onCreateConnector: () => void;
  onSubmitEvent: () => void;
  onSaveCredentials: () => void;
  onSaveWebsiteForm: () => void;
  onSimulateWhatsapp: () => void;
}

const connectorTypes = [
  "WHATSAPP",
  "WEBSITE",
  "COMMERCE",
  "PAYMENT",
  "EMAIL",
  "SOCIAL",
  "CUSTOM",
];
const eventKinds = [
  "INQUIRY",
  "SUPPORT_REQUEST",
  "COMPLAINT",
  "SALES_OPPORTUNITY",
  "ORDER_REQUEST",
  "ORDER",
  "PAYMENT",
  "REFUND",
  "WEBSITE_CHANGE",
  "UNKNOWN",
  "SPAM",
];

export function BridgeDialogs(props: BridgeDialogsProps) {
  const { open } = props;
  if (!open) return null;

  return (
    <div className="agent-modal">
      <div className="agent-dialog bridge-dialog">
        <header>
          <h3>
            {open === "credentials"
              ? "Configure WhatsApp"
              : open === "whatsapp-simulator"
                ? "WhatsApp CRM Intake Simulator"
                : open === "website-form"
                  ? "Configure website lead form"
                  : open === "connector"
                    ? "Create connector"
                    : "Receive controlled test event"}
          </h3>
          <button onClick={props.onClose}>×</button>
        </header>
        {open === "whatsapp-simulator" ? (
          <SimulatorDialog {...props} />
        ) : open === "website-form" ? (
          <WebsiteFormDialog {...props} />
        ) : open === "credentials" ? (
          <CredentialsDialog {...props} />
        ) : open === "connector" ? (
          <ConnectorDialog {...props} />
        ) : (
          <EventDialog {...props} />
        )}
      </div>
    </div>
  );
}

function SimulatorDialog(props: BridgeDialogsProps) {
  const form = props.simulatorMessage;
  return (
    <>
      <div className="inventory-control-note">
        This simulator creates real organization-scoped CRM records and approval
        drafts, but it never contacts Meta or sends a message.
      </div>
      {props.simulatorResult && (
        <div className="bridge-secret">
          <strong>{props.simulatorResult}</strong>
        </div>
      )}
      <div className="agent-form-grid">
        <label>
          <span>Simulator connector</span>
          <select
            value={props.selected}
            onChange={(event) => props.setSelected(event.target.value)}
          >
            {props.connectors
              .filter(
                (item) =>
                  item.type === "WHATSAPP" &&
                  item.provider.toUpperCase() === "B2BRAIN_SIMULATOR",
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>External WhatsApp message ID</span>
          <input
            value={form.externalMessageId}
            onChange={(event) =>
              props.setSimulatorMessage({
                ...form,
                externalMessageId: event.target.value,
              })
            }
          />
        </label>
        <label>
          <span>Customer name</span>
          <input
            value={form.contactName}
            onChange={(event) =>
              props.setSimulatorMessage({
                ...form,
                contactName: event.target.value,
              })
            }
          />
        </label>
        <label>
          <span>WhatsApp phone</span>
          <input
            placeholder="919876543210"
            value={form.from}
            onChange={(event) =>
              props.setSimulatorMessage({ ...form, from: event.target.value })
            }
          />
        </label>
      </div>
      <label>
        <span>Incoming customer message</span>
        <textarea
          rows={4}
          maxLength={4096}
          value={form.message}
          onChange={(event) =>
            props.setSimulatorMessage({ ...form, message: event.target.value })
          }
        />
      </label>
      <footer>
        <button onClick={props.onClose}>Close</button>
        <button onClick={props.onSimulateWhatsapp}>Process message</button>
      </footer>
    </>
  );
}

function WebsiteFormDialog(props: BridgeDialogsProps) {
  const form = props.websiteForm;
  const formKey =
    props.connectors.find((item) => item.id === props.selected)?.webhookKey ??
    "FORM_KEY";
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://your-b2brain-domain";
  return (
    <>
      <div className="agent-form-grid">
        <label>
          <span>Form title</span>
          <input
            value={form.title}
            onChange={(event) =>
              props.setWebsiteForm({ ...form, title: event.target.value })
            }
          />
        </label>
        <label>
          <span>Button label</span>
          <input
            value={form.submitLabel}
            onChange={(event) =>
              props.setWebsiteForm({ ...form, submitLabel: event.target.value })
            }
          />
        </label>
        <label>
          <span>Service field label</span>
          <input
            value={form.serviceLabel}
            onChange={(event) =>
              props.setWebsiteForm({
                ...form,
                serviceLabel: event.target.value,
              })
            }
          />
        </label>
        <label>
          <span>Accent color</span>
          <input
            type="color"
            value={form.accentColor}
            onChange={(event) =>
              props.setWebsiteForm({ ...form, accentColor: event.target.value })
            }
          />
        </label>
      </div>
      <label>
        <span>Description</span>
        <textarea
          rows={2}
          value={form.description}
          onChange={(event) =>
            props.setWebsiteForm({ ...form, description: event.target.value })
          }
        />
      </label>
      <label>
        <span>Success message</span>
        <textarea
          rows={2}
          value={form.successMessage}
          onChange={(event) =>
            props.setWebsiteForm({
              ...form,
              successMessage: event.target.value,
            })
          }
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={form.askService}
          onChange={(event) =>
            props.setWebsiteForm({ ...form, askService: event.target.checked })
          }
        />{" "}
        Ask which service the customer needs
      </label>
      <div className="inventory-control-note">
        Embed code:{" "}
        <code>{`<iframe src="${origin}/forms/${formKey}" width="100%" height="720" style="border:0" loading="lazy"></iframe>`}</code>
      </div>
      <footer>
        <button onClick={props.onClose}>Cancel</button>
        <button onClick={props.onSaveWebsiteForm}>Save form</button>
      </footer>
    </>
  );
}

function CredentialsDialog(props: BridgeDialogsProps) {
  const form = props.credentials;
  return (
    <>
      <label>
        <span>WhatsApp connector</span>
        <select
          value={props.selected}
          onChange={(event) => props.setSelected(event.target.value)}
        >
          {props.connectors
            .filter((item) => item.type === "WHATSAPP")
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      <div className="agent-form-grid">
        <label>
          <span>Phone number ID</span>
          <input
            value={form.phoneNumberId}
            onChange={(event) =>
              props.setCredentials({
                ...form,
                phoneNumberId: event.target.value,
              })
            }
          />
        </label>
        <label>
          <span>Business account ID</span>
          <input
            value={form.businessAccountId}
            onChange={(event) =>
              props.setCredentials({
                ...form,
                businessAccountId: event.target.value,
              })
            }
          />
        </label>
        <label>
          <span>Permanent access token</span>
          <input
            type="password"
            autoComplete="off"
            value={form.accessToken}
            onChange={(event) =>
              props.setCredentials({ ...form, accessToken: event.target.value })
            }
          />
        </label>
        <label>
          <span>Meta App Secret</span>
          <input
            type="password"
            autoComplete="off"
            value={form.appSecret}
            onChange={(event) =>
              props.setCredentials({ ...form, appSecret: event.target.value })
            }
          />
        </label>
      </div>
      <div className="inventory-control-note">
        Credentials are encrypted before database storage and never returned to
        the browser. Use the connector&apos;s one-time secret as Meta&apos;s
        verify token.
      </div>
      <footer>
        <button onClick={props.onClose}>Cancel</button>
        <button
          disabled={
            !props.selected ||
            !form.phoneNumberId ||
            !form.businessAccountId ||
            form.accessToken.length < 20 ||
            form.appSecret.length < 10
          }
          onClick={props.onSaveCredentials}
        >
          Encrypt & save
        </button>
      </footer>
    </>
  );
}

function ConnectorDialog(props: BridgeDialogsProps) {
  const form = props.connector;
  return (
    <>
      <div className="agent-form-grid">
        <label>
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) =>
              props.setConnector({ ...form, name: event.target.value })
            }
          />
        </label>
        <label>
          <span>Type</span>
          <select
            value={form.type}
            onChange={(event) =>
              props.setConnector({ ...form, type: event.target.value })
            }
          >
            {connectorTypes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Provider</span>
          <input
            value={form.provider}
            onChange={(event) =>
              props.setConnector({ ...form, provider: event.target.value })
            }
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={form.status}
            onChange={(event) =>
              props.setConnector({ ...form, status: event.target.value })
            }
          >
            <option>DRAFT</option>
            <option>ACTIVE</option>
            <option>PAUSED</option>
          </select>
        </label>
        <label>
          <span>Automation mode</span>
          <select
            value={form.mode}
            onChange={(event) =>
              props.setConnector({ ...form, mode: event.target.value })
            }
          >
            <option>MANUAL_APPROVAL</option>
            <option>ASSISTED</option>
            <option>POLICY_LIMITED</option>
          </select>
        </label>
      </div>
      <div className="inventory-control-note">
        Creating this record does not connect a provider. Real webhook
        activation requires official provider credentials and signature
        verification.
      </div>
      <footer>
        <button onClick={props.onClose}>Cancel</button>
        <button
          disabled={!form.name || !form.provider}
          onClick={props.onCreateConnector}
        >
          Create
        </button>
      </footer>
    </>
  );
}

function EventDialog(props: BridgeDialogsProps) {
  const form = props.event;
  return (
    <>
      <label>
        <span>Connector</span>
        <select
          value={props.selected}
          onChange={(event) => props.setSelected(event.target.value)}
        >
          {props.connectors
            .filter((item) => item.status === "ACTIVE")
            .map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      <div className="agent-form-grid">
        <label>
          <span>External event ID</span>
          <input
            value={form.externalEventId}
            onChange={(event) =>
              props.setEvent({ ...form, externalEventId: event.target.value })
            }
          />
        </label>
        <label>
          <span>Kind</span>
          <select
            value={form.kind}
            onChange={(event) =>
              props.setEvent({ ...form, kind: event.target.value })
            }
          >
            {eventKinds.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Contact name</span>
          <input
            value={form.contactName}
            onChange={(event) =>
              props.setEvent({ ...form, contactName: event.target.value })
            }
          />
        </label>
        <label>
          <span>Email</span>
          <input
            value={form.email}
            onChange={(event) =>
              props.setEvent({ ...form, email: event.target.value })
            }
          />
        </label>
        <label>
          <span>Phone</span>
          <input
            value={form.phone}
            onChange={(event) =>
              props.setEvent({ ...form, phone: event.target.value })
            }
          />
        </label>
        <label>
          <span>Subject</span>
          <input
            value={form.subject}
            onChange={(event) =>
              props.setEvent({ ...form, subject: event.target.value })
            }
          />
        </label>
      </div>
      <label>
        <span>Message</span>
        <textarea
          value={form.message}
          onChange={(event) =>
            props.setEvent({ ...form, message: event.target.value })
          }
        />
      </label>
      <footer>
        <button onClick={props.onClose}>Cancel</button>
        <button
          disabled={!props.selected || !form.externalEventId}
          onClick={props.onSubmitEvent}
        >
          Receive event
        </button>
      </footer>
    </>
  );
}
