import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerService } from "../src/modules/customers/customer.service.js";
import { EngagementService } from "../src/modules/customer-engagement/engagement.service.js";

const ORG_A = "00000000-0000-4000-8000-00000000000a";
const ORG_B = "00000000-0000-4000-8000-00000000000b";
const CUSTOMER_A = "10000000-0000-4000-8000-00000000000a";
const USER_B = "20000000-0000-4000-8000-00000000000b";

const query = { archived: false, page: 1, pageSize: 20 };

describe("customer tenant isolation", () => {
  const customerRepository = {
    list: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn(),
    archive: vi.fn(), restore: vi.fn(), permanentlyDelete: vi.fn(),
  };
  const engagementRepository = {
    customer: vi.fn(), timeline: vi.fn(), createActivity: vi.fn(), archiveActivity: vi.fn(),
    createFollowUp: vi.fn(), updateFollowUpStatus: vi.fn(), archiveFollowUp: vi.fn(), followUpCenter: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    customerRepository.list.mockImplementation((organizationId: string) => Promise.resolve({
      items: organizationId === ORG_A ? [{ id: CUSTOMER_A, organizationId: ORG_A }] : [],
      total: organizationId === ORG_A ? 1 : 0,
    }));
    customerRepository.find.mockImplementation((organizationId: string, id: string) =>
      Promise.resolve(organizationId === ORG_A && id === CUSTOMER_A ? { id, organizationId } : null),
    );
    customerRepository.archive.mockResolvedValue({ count: 0 });
    customerRepository.restore.mockResolvedValue({ count: 0 });
    customerRepository.permanentlyDelete.mockResolvedValue({ count: 0 });
    engagementRepository.customer.mockImplementation((organizationId: string, id: string) =>
      Promise.resolve(organizationId === ORG_A && id === CUSTOMER_A ? { id } : null),
    );
  });

  it("does not list another organization's customer", async () => {
    const service = new CustomerService(customerRepository as never);
    const result = await service.list(ORG_B, query);
    expect(result.customers).toEqual([]);
    expect(customerRepository.list).toHaveBeenCalledWith(ORG_B, query);
  });

  it("returns 404 when another organization views or updates the customer", async () => {
    const service = new CustomerService(customerRepository as never);
    await expect(service.get(ORG_B, CUSTOMER_A)).rejects.toMatchObject({ statusCode: 404, code: "CUSTOMER_NOT_FOUND" });
    await expect(service.update(ORG_B, USER_B, CUSTOMER_A, {} as never)).rejects.toMatchObject({ statusCode: 404, code: "CUSTOMER_NOT_FOUND" });
    expect(customerRepository.update).not.toHaveBeenCalled();
  });

  it("returns 404 when another organization archives, restores, or deletes the customer", async () => {
    const service = new CustomerService(customerRepository as never);
    await expect(service.archive(ORG_B, USER_B, CUSTOMER_A)).rejects.toMatchObject({ statusCode: 404, code: "CUSTOMER_NOT_FOUND" });
    await expect(service.restore(ORG_B, USER_B, CUSTOMER_A)).rejects.toMatchObject({ statusCode: 404, code: "CUSTOMER_NOT_FOUND" });
    await expect(service.permanentlyDelete(ORG_B, CUSTOMER_A)).rejects.toMatchObject({ statusCode: 404, code: "CUSTOMER_NOT_FOUND" });
    expect(customerRepository.archive).toHaveBeenCalledWith(ORG_B, CUSTOMER_A, USER_B);
    expect(customerRepository.restore).toHaveBeenCalledWith(ORG_B, CUSTOMER_A, USER_B);
    expect(customerRepository.permanentlyDelete).toHaveBeenCalledWith(ORG_B, CUSTOMER_A);
  });

  it("cannot view a timeline or create related records for another organization's customer", async () => {
    const service = new EngagementService(engagementRepository as never);
    await expect(service.timeline(ORG_B, CUSTOMER_A)).rejects.toMatchObject({ statusCode: 404, code: "CUSTOMER_NOT_FOUND" });
    await expect(service.createActivity(ORG_B, CUSTOMER_A, USER_B, {} as never)).rejects.toMatchObject({ statusCode: 404, code: "CUSTOMER_NOT_FOUND" });
    await expect(service.createFollowUp(ORG_B, CUSTOMER_A, USER_B, {} as never)).rejects.toMatchObject({ statusCode: 404, code: "CUSTOMER_NOT_FOUND" });
    expect(engagementRepository.timeline).not.toHaveBeenCalled();
    expect(engagementRepository.createActivity).not.toHaveBeenCalled();
    expect(engagementRepository.createFollowUp).not.toHaveBeenCalled();
  });

  it("scopes activity and follow-up mutations by both organization and customer", async () => {
    engagementRepository.archiveActivity.mockResolvedValue({ count: 0 });
    engagementRepository.updateFollowUpStatus.mockResolvedValue({ count: 0 });
    engagementRepository.archiveFollowUp.mockResolvedValue({ count: 0 });
    const service = new EngagementService(engagementRepository as never);
    await expect(service.archiveActivity(ORG_B, CUSTOMER_A, USER_B, "activity-a")).rejects.toMatchObject({ statusCode: 404, code: "ACTIVITY_NOT_FOUND" });
    await expect(service.updateFollowUpStatus(ORG_B, CUSTOMER_A, USER_B, "follow-up-a", { status: "COMPLETED" })).rejects.toMatchObject({ statusCode: 404, code: "FOLLOW_UP_NOT_FOUND" });
    await expect(service.archiveFollowUp(ORG_B, CUSTOMER_A, USER_B, "follow-up-a")).rejects.toMatchObject({ statusCode: 404, code: "FOLLOW_UP_NOT_FOUND" });
    expect(engagementRepository.archiveActivity).toHaveBeenCalledWith(ORG_B, CUSTOMER_A, "activity-a", USER_B);
    expect(engagementRepository.updateFollowUpStatus).toHaveBeenCalledWith(ORG_B, CUSTOMER_A, "follow-up-a", USER_B, { status: "COMPLETED" });
    expect(engagementRepository.archiveFollowUp).toHaveBeenCalledWith(ORG_B, CUSTOMER_A, "follow-up-a", USER_B);
  });
});
