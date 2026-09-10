import { randomBytes } from "node:crypto";
import { AppError } from "../../shared/errors/app-error.js";

export const WHATSAPP_REQUIRED_SCOPES = [
  "whatsapp_business_management",
  "whatsapp_business_messaging",
] as const;

export type WhatsappPhoneChoice = {
  id: string;
  maskedDisplayNumber: string;
  verifiedName: string;
};
export type WhatsappBusinessChoice = {
  id: string;
  verifiedBusinessName: string;
  permissions: string[];
  phoneNumbers: WhatsappPhoneChoice[];
  token: string;
};

export interface WhatsappConnectionProvider {
  readonly mode: "TEST";
  authorize(state: string, returnPath: string, connectorId: string): string;
  exchange(code: string): Promise<{ accounts: WhatsappBusinessChoice[]; expiresAt: string }>;
  testSubscription(wabaId: string, phoneNumberId: string): Promise<boolean>;
}

const syntheticAccounts = () : WhatsappBusinessChoice[] => [
  {
    id: "700000000000001",
    verifiedBusinessName: "Synthetic B2 Test Store",
    permissions: [...WHATSAPP_REQUIRED_SCOPES],
    token: randomBytes(32).toString("base64url"),
    phoneNumbers: [
      { id: "710000000000001", maskedDisplayNumber: "+91 ••••• ••101", verifiedName: "Synthetic Support" },
      { id: "710000000000002", maskedDisplayNumber: "+91 ••••• ••202", verifiedName: "Synthetic Sales" },
    ],
  },
  {
    id: "700000000000002",
    verifiedBusinessName: "Synthetic Academy Test",
    permissions: [...WHATSAPP_REQUIRED_SCOPES],
    token: randomBytes(32).toString("base64url"),
    phoneNumbers: [
      { id: "720000000000001", maskedDisplayNumber: "+91 ••••• ••303", verifiedName: "Synthetic Admissions" },
    ],
  },
];

export class FakeWhatsappConnectionProvider implements WhatsappConnectionProvider {
  readonly mode = "TEST" as const;
  private readonly accounts = syntheticAccounts();

  authorize(state: string, returnPath: string, connectorId: string) {
    const separator = returnPath.includes("?") ? "&" : "?";
    return `${returnPath}${separator}wa_code=fake-approved&wa_state=${encodeURIComponent(state)}&wa_connector=${encodeURIComponent(connectorId)}`;
  }

  exchange(code: string) {
    if (code === "fake-timeout") return Promise.reject(new AppError(504, "WhatsApp test provider timed out.", "WHATSAPP_TEST_PROVIDER_TIMEOUT"));
    if (code === "fake-malformed") return Promise.reject(new AppError(400, "WhatsApp test provider returned an invalid response.", "WHATSAPP_TEST_PROVIDER_INVALID"));
    if (code !== "fake-approved") return Promise.reject(new AppError(400, "WhatsApp test authorization failed.", "WHATSAPP_AUTHORIZATION_FAILED"));
    return Promise.resolve({ accounts: this.accounts, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
  }

  testSubscription(wabaId: string, phoneNumberId: string) {
    return Promise.resolve(Boolean(this.accounts.find((account) => account.id === wabaId)?.phoneNumbers.some((phone) => phone.id === phoneNumberId)));
  }
}
