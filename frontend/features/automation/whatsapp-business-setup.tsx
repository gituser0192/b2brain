"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

type Phone = { id: string; maskedDisplayNumber: string; verifiedName: string };
type Account = { id: string; verifiedBusinessName: string; permissions: string[]; phoneNumbers: Phone[] };
type Status = {
  connectorStatus: string;
  mode: "TEST";
  setupState: string;
  accounts: Account[];
  selectedAccount: { id: string; verifiedBusinessName: string } | null;
  selectedNumber: Omit<Phone, "id"> | null;
  grantedScopes: string[];
  permissionsValid: boolean;
  webhookReady: boolean;
  authorizationVerifiedAt: string | null;
  numberVerifiedAt: string | null;
  lastTestAt: string | null;
  outboundEnabled: false;
  canActivateProduction: false;
};

export function WhatsappBusinessSetup({ connectorId, canManage }: { connectorId: string; canManage: boolean }) {
  const { authorizedRequest } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackStarted = useRef(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [accountId, setAccountId] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await authorizedRequest<{ success: true; data: Status }>(`/automation-bridge/connectors/${connectorId}/whatsapp-setup/status`);
    setStatus(response.data);
    setAccounts(response.data.accounts);
  }, [authorizedRequest, connectorId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch(() => setNotice("Unable to load WhatsApp setup status.")), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const state = searchParams.get("wa_state");
    const code = searchParams.get("wa_code");
    const target = searchParams.get("wa_connector");
    if (!state || !code || target !== connectorId || callbackStarted.current) return;
    callbackStarted.current = true;
    const timer = window.setTimeout(() => {
      setBusy(true);
      void authorizedRequest<{ success: true; data: { accounts: Account[] } }>(`/automation-bridge/connectors/${connectorId}/whatsapp-setup/callback`, { method: "POST", body: JSON.stringify({ state, code }) })
        .then((response) => {
          setAccounts(response.data.accounts);
          router.replace("/automation?section=connections");
          setNotice("Test authorization completed. Choose a synthetic business account.");
        })
        .catch((error) => setNotice(error instanceof ApiError ? error.message : "WhatsApp test authorization failed."))
        .finally(() => setBusy(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authorizedRequest, connectorId, router, searchParams]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
      await load();
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "WhatsApp setup action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    await run(async () => {
      const response = await authorizedRequest<{ success: true; data: { authorizationUrl: string } }>(`/automation-bridge/connectors/${connectorId}/whatsapp-setup/authorize`, { method: "POST", body: JSON.stringify({ returnPath: "/automation?section=connections" }) });
      router.push(response.data.authorizationUrl);
    });
  }

  async function chooseAccount() {
    await run(async () => {
      const response = await authorizedRequest<{ success: true; data: { phoneNumbers: Phone[] } }>(`/automation-bridge/connectors/${connectorId}/whatsapp-setup/account`, { method: "PUT", body: JSON.stringify({ wabaId: accountId }) });
      setPhones(response.data.phoneNumbers);
      setNotice("Synthetic business account verified. Choose its WhatsApp number.");
    });
  }

  async function chooseNumber() {
    await run(async () => {
      await authorizedRequest(`/automation-bridge/connectors/${connectorId}/whatsapp-setup/number`, { method: "PUT", body: JSON.stringify({ phoneNumberId: phoneId }) });
      setNotice("Synthetic WhatsApp number selected. Run the readiness test.");
    });
  }

  async function post(action: string, message: string) {
    await run(async () => {
      await authorizedRequest(`/automation-bridge/connectors/${connectorId}/whatsapp-setup/${action}`, { method: "POST" });
      setNotice(message);
    });
  }

  async function reconnect() {
    await run(async () => {
      const response = await authorizedRequest<{ success: true; data: { authorizationUrl: string } }>(`/automation-bridge/connectors/${connectorId}/whatsapp-setup/reconnect`, { method: "POST" });
      router.push(response.data.authorizationUrl);
    });
  }

  const steps = [
    ["Authorization", Boolean(status?.authorizationVerifiedAt)],
    ["Business account", Boolean(status?.selectedAccount)],
    ["WhatsApp number", Boolean(status?.selectedNumber)],
    ["Required permissions", Boolean(status?.permissionsValid)],
    ["Inbound readiness", Boolean(status?.webhookReady)],
  ] as const;
  const stateLabel = status?.setupState === "READY_TEST"
    ? "Test ready"
    : status?.setupState?.replaceAll("_", " ") ?? "Loading";

  return (
    <section className="whatsapp-business-setup" aria-labelledby={`whatsapp-setup-${connectorId}`}>
      <header>
        <div>
          <p>WhatsApp Business — Test Mode</p>
          <h3 id={`whatsapp-setup-${connectorId}`}>Guided connection</h3>
          <span>No real WhatsApp account is connected. No messages will be sent.</span>
        </div>
        <strong>TEST MODE</strong>
      </header>
      {!canManage && <p className="whatsapp-setup-notice" role="status">You can view this setup, but AUTOMATION_MANAGE permission is required to make changes.</p>}
      {notice && <p className="whatsapp-setup-notice" role="status">{notice}</p>}
      <div className="whatsapp-setup-state">
        <span>State <b>{stateLabel}</b></span>
        <span>Business <b>{status?.selectedAccount?.verifiedBusinessName ?? "Not selected"}</b></span>
        <span>Number <b>{status?.selectedNumber?.maskedDisplayNumber ?? "Not selected"}</b></span>
        <span>Outbound <b>Disabled</b></span>
      </div>
      <ol className="whatsapp-setup-checklist" aria-label="WhatsApp Business setup progress">
        {steps.map(([label, complete]) => <li className={complete ? "complete" : ""} key={label}><span aria-hidden="true">{complete ? "✓" : "○"}</span>{label}</li>)}
      </ol>
      <div className="whatsapp-setup-actions">
        <button disabled={!canManage || busy} onClick={() => void connect()}>Connect WhatsApp</button>
        {accounts.length > 0 && <label>Verified synthetic business account<select value={accountId} onChange={(event) => { setAccountId(event.target.value); setPhones(accounts.find((item) => item.id === event.target.value)?.phoneNumbers ?? []); setPhoneId(""); }}><option value="">Choose account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.verifiedBusinessName}</option>)}</select><button disabled={!canManage || busy || !accountId} onClick={() => void chooseAccount()}>Use account</button></label>}
        {phones.length > 0 && <label>Verified synthetic WhatsApp number<select value={phoneId} onChange={(event) => setPhoneId(event.target.value)}><option value="">Choose number</option>{phones.map((phone) => <option key={phone.id} value={phone.id}>{phone.verifiedName} · {phone.maskedDisplayNumber}</option>)}</select><button disabled={!canManage || busy || !phoneId} onClick={() => void chooseNumber()}>Use number</button></label>}
        <button disabled={!canManage || busy || !status?.selectedNumber} onClick={() => void post("test", "Test Mode inbound readiness passed. No customer record or message was created.")}>Test connection</button>
        <button disabled={!canManage || busy} onClick={() => void reconnect()}>Reconnect</button>
        <button disabled={!canManage || busy} onClick={() => { if (window.confirm("Disconnect WhatsApp Test Mode? CRM records and event history will be preserved.")) void post("disconnect", "WhatsApp Test Mode disconnected. CRM records and history were preserved."); }}>Disconnect</button>
      </div>
      <small>Test Connection checks only synthetic ownership, permissions, mapping and inbound readiness. It does not contact Meta, invoke AI, create CRM data or enable outbound delivery.</small>
    </section>
  );
}
