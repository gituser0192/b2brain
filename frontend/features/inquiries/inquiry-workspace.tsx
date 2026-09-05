"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { DealConversionDialog } from "./deal-conversion-dialog";
import { InquiryInbox, type InquiryItem } from "./inquiry-inbox";
import {
  InquiryFormDialog,
  type DuplicateInquiry,
} from "./inquiry-form-dialog";
import type { AssignmentEmployee } from "./lead-assignment-control";
import { LeadAssignmentManager } from "./lead-assignment-manager";
type Ref = {
  id: string;
  firstName?: string;
  lastName?: string | null;
  name?: string;
};
type Payload = {
  success: true;
  data: {
    inquiries: InquiryItem[];
    employees: Ref[];
    campaigns: Ref[];
    metrics: Record<string, number>;
  };
};
const blank = () => ({
  source: "MANUAL",
  type: "UNCLASSIFIED",
  status: "NEW",
  priority: "MEDIUM",
  contactName: "",
  email: "",
  phone: "",
  companyName: "",
  subject: "",
  message: "",
  campaignId: "",
  assignedEmployeeId: "",
  responseDueAt: "",
  disqualifiedReason: "",
});
export function InquiryWorkspace({
  onNavigate,
  selectedInquiryId = null,
}: {
  onNavigate: (view: "crm" | "sales" | "support") => void;
  selectedInquiryId?: string | null;
}) {
  const { session, authorizedRequest } = useAuth(),
    [items, setItems] = useState<InquiryItem[]>([]),
    [employees, setEmployees] = useState<Ref[]>([]),
    [campaigns, setCampaigns] = useState<Ref[]>([]),
    [metrics, setMetrics] = useState<Record<string, number>>({}),
    [chosen, setChosen] = useState<InquiryItem | null>(null),
    [form, setForm] = useState(blank()),
    [open, setOpen] = useState(false),
    [showRules, setShowRules] = useState(false),
    [dealConversionOpen, setDealConversionOpen] = useState(false),
    [dealConversion, setDealConversion] = useState({
      name: "",
      amount: 0,
      currency: "INR",
      probability: 50,
      expectedCloseDate: "",
    }),
    [duplicate, setDuplicate] = useState<DuplicateInquiry | null>(null),
    [error, setError] = useState("");
  const manage =
      session?.membership.permissions.includes("INQUIRY_MANAGE") ?? false,
    canConvert =
      session?.membership.permissions.includes("INQUIRY_CONVERT") ?? false;
  const load = useCallback(async () => {
    try {
      const r = await authorizedRequest<Payload>("/inquiries");
      setItems(r.data.inquiries);
      setEmployees(r.data.employees);
      setCampaigns(r.data.campaigns);
      setMetrics(r.data.metrics);
      setChosen(
        (c) =>
          r.data.inquiries.find((x) => x.id === c?.id) ??
          r.data.inquiries[0] ??
          null,
      );
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to load inquiries.");
    }
  }, [authorizedRequest]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  useEffect(() => {
    const selected = items.find((item) => item.id === selectedInquiryId);
    if (selected) show(selected);
  }, [items, selectedInquiryId]);
  function show(i?: InquiryItem) {
    setDuplicate(null);
    setChosen(i ?? null);
    setForm(
      i
        ? {
            source: i.source,
            type: i.type,
            status: i.status,
            priority: i.priority,
            contactName: i.contactName,
            email: i.email ?? "",
            phone: i.phone ?? "",
            companyName: i.companyName ?? "",
            subject: i.subject,
            message: i.message,
            campaignId: i.campaignId ?? "",
            assignedEmployeeId: i.assignedEmployeeId ?? "",
            responseDueAt: i.responseDueAt?.slice(0, 16) ?? "",
            disqualifiedReason: i.disqualifiedReason ?? "",
          }
        : blank(),
    );
    setOpen(true);
  }
  function requestBody() {
    return JSON.stringify({
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      companyName: form.companyName || null,
      campaignId: form.campaignId || null,
      assignedEmployeeId: form.assignedEmployeeId || null,
      responseDueAt: form.responseDueAt
        ? new Date(form.responseDueAt).toISOString()
        : null,
      disqualifiedReason: form.disqualifiedReason || null,
    });
  }
  async function save(allowDuplicate = false) {
    try {
      await authorizedRequest(
        chosen
          ? `/inquiries/${chosen.id}`
          : `/inquiries${allowDuplicate ? "?allowDuplicate=true" : ""}`,
        {
          method: chosen ? "PUT" : "POST",
          body: requestBody(),
        },
      );
      setDuplicate(null);
      setOpen(false);
      await load();
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.code === "DUPLICATE_INQUIRY" &&
        e.errors?.inquiryId
      ) {
        setDuplicate({
          inquiryId: e.errors.inquiryId,
          contactName: e.errors.contactName ?? "Existing contact",
          subject: e.errors.subject ?? form.subject,
        });
        return;
      }
      setError(e instanceof ApiError ? e.message : "Unable to save inquiry.");
    }
  }
  function openDuplicate() {
    const existing = items.find((item) => item.id === duplicate?.inquiryId);
    if (existing) setChosen(existing);
    setDuplicate(null);
    setOpen(false);
  }
  async function mergeDuplicate() {
    if (!duplicate) return;
    try {
      await authorizedRequest(`/inquiries/${duplicate.inquiryId}/messages`, {
        method: "POST",
        body: JSON.stringify({ source: form.source, message: form.message }),
      });
      const existingId = duplicate.inquiryId;
      setDuplicate(null);
      setOpen(false);
      setChosen(items.find((item) => item.id === existingId) ?? null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to attach the message.",
      );
    }
  }
  async function note() {
    if (!chosen) return;
    const value = prompt("Internal note");
    if (value) {
      await authorizedRequest(`/inquiries/${chosen.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: value }),
      });
      await load();
    }
  }
  async function logContact() {
    if (!chosen) return;
    const channel = prompt(
      "Contact channel: CALL, WHATSAPP, EMAIL, MEETING or NOTE",
      "CALL",
    )
      ?.trim()
      .toUpperCase();
    if (
      !channel ||
      !["CALL", "WHATSAPP", "EMAIL", "MEETING", "NOTE"].includes(channel)
    )
      return;
    const summary = prompt("What happened?");
    if (!summary?.trim()) return;
    const details = prompt("Optional details") ?? "";
    try {
      await authorizedRequest(`/inquiries/${chosen.id}/contact`, {
        method: "POST",
        body: JSON.stringify({ channel, summary, details }),
      });
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to log contact activity.",
      );
    }
  }
  async function scheduleFollowUp() {
    if (!chosen) return;
    const dueAt = prompt(
      "Follow-up date and time (example: 2026-08-12T10:30)",
      new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
    );
    if (!dueAt) return;
    const note = prompt("What should happen in this follow-up?");
    if (!note?.trim()) return;
    try {
      await authorizedRequest(`/inquiries/${chosen.id}/follow-up`, {
        method: "POST",
        body: JSON.stringify({ dueAt: new Date(dueAt).toISOString(), note }),
      });
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to schedule follow-up.",
      );
    }
  }
  async function completeFollowUp() {
    if (!chosen) return;
    try {
      await authorizedRequest(`/inquiries/${chosen.id}/follow-up/complete`, {
        method: "POST",
      });
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to complete follow-up.",
      );
    }
  }
  async function convert(target: "CUSTOMER" | "DEAL" | "SUPPORT") {
    if (!chosen) return;
    let body: Record<string, unknown> = { target };
    if (target === "DEAL") {
      setDealConversion({
        name: chosen.subject,
        amount: 0,
        currency: "INR",
        probability: 50,
        expectedCloseDate: "",
      });
      setDealConversionOpen(true);
      return;
    }
    if (target === "SUPPORT")
      body = {
        target,
        subject: chosen.subject,
        description: chosen.message,
        priority: chosen.priority,
      };
    try {
      await authorizedRequest(`/inquiries/${chosen.id}/convert`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load();
      onNavigate(target === "CUSTOMER" ? "crm" : "support");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Conversion failed.");
    }
  }
  async function convertToDeal() {
    if (!chosen) return;
    try {
      await authorizedRequest(`/inquiries/${chosen.id}/convert`, {
        method: "POST",
        body: JSON.stringify({
          target: "DEAL",
          ...dealConversion,
          expectedCloseDate: dealConversion.expectedCloseDate || null,
        }),
      });
      setDealConversionOpen(false);
      await load();
      onNavigate("sales");
    } catch (reason) {
      setError(
        reason instanceof ApiError ? reason.message : "Deal conversion failed.",
      );
    }
  }
  return (
    <div className="inquiry-workspace">
      <header className="project-heading">
        <div>
          <p>Controlled intake</p>
          <h2>Lead & inquiry inbox</h2>
          <span>Move each enquiry from first contact to a recorded outcome.</span>
        </div>
        {manage && (
          <div className="inquiry-header-actions">
            <button onClick={() => onNavigate("crm")}>Customers</button>
            <button onClick={() => setShowRules((value) => !value)}>
              {showRules ? "Close rules" : "Assignment rules"}
            </button>
            <button onClick={() => show()}>+ Capture inquiry</button>
          </div>
        )}
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      {showRules && <LeadAssignmentManager onChanged={load} />}
      <InquiryInbox
        items={items}
        chosen={chosen}
        metrics={metrics}
        employees={employees as AssignmentEmployee[]}
        canManage={manage}
        canConvert={canConvert}
        onChoose={setChosen}
        onEdit={show}
        onChanged={load}
        onLogContact={() => void logContact()}
        onScheduleFollowUp={() => void scheduleFollowUp()}
        onCompleteFollowUp={() => void completeFollowUp()}
        onConvert={(target) => void convert(target)}
        onAddNote={() => void note()}
      />
      {open && (
        <InquiryFormDialog
          isEditing={Boolean(chosen)}
          form={form}
          setForm={setForm}
          employees={employees}
          campaigns={campaigns}
          duplicate={duplicate}
          onClose={() => setOpen(false)}
          onOpenDuplicate={openDuplicate}
          onMergeDuplicate={() => void mergeDuplicate()}
          onSave={(allowDuplicate) => void save(allowDuplicate)}
        />
      )}
      {dealConversionOpen && chosen && (
        <DealConversionDialog
          value={dealConversion}
          onChange={setDealConversion}
          onClose={() => setDealConversionOpen(false)}
          onConvert={() => void convertToDeal()}
        />
      )}
    </div>
  );
}
