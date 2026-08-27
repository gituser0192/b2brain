import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectService } from "../src/modules/projects/project.service.js";

const ORG_A = "00000000-0000-4000-8000-00000000000a";
const ORG_B = "00000000-0000-4000-8000-00000000000b";
const PROJECT_A = "10000000-0000-4000-8000-00000000000a";
const CUSTOMER_A = "20000000-0000-4000-8000-00000000000a";
const EMPLOYEE_A = "30000000-0000-4000-8000-00000000000a";
const MEMBERSHIP_A = "40000000-0000-4000-8000-00000000000a";
const USER_B = "50000000-0000-4000-8000-00000000000b";

const projectInput = {
  name: "Tenant boundary project", code: "BOUNDARY", description: null, customerId: null,
  status: "ACTIVE", priority: "MEDIUM", startDate: null, dueDate: null,
} as const;
const taskInput = {
  title: "Protected task", description: null, status: "TODO", priority: "MEDIUM",
  dueDate: null, assignedMembershipId: null,
} as const;

describe("project tenant isolation", () => {
  const repository = {
    list: vi.fn(), find: vi.fn(), customer: vi.fn(), create: vi.fn(), update: vi.fn(),
    archive: vi.fn(), restore: vi.fn(), tasks: vi.fn(), activeMember: vi.fn(),
    activeEmployee: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), archiveTask: vi.fn(),
    members: vi.fn(), addMember: vi.fn(), removeMember: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.list.mockImplementation((organizationId: string) => Promise.resolve(
      organizationId === ORG_A ? [{ id: PROJECT_A, organizationId: ORG_A }] : [],
    ));
    repository.find.mockImplementation((organizationId: string, id: string) => Promise.resolve(
      organizationId === ORG_A && id === PROJECT_A ? { id, organizationId } : null,
    ));
    repository.customer.mockImplementation((organizationId: string, id: string) => Promise.resolve(
      organizationId === ORG_A && id === CUSTOMER_A ? { id } : null,
    ));
    repository.activeEmployee.mockImplementation((organizationId: string, id: string) => Promise.resolve(
      organizationId === ORG_A && id === EMPLOYEE_A ? { id, linkedUserId: null } : null,
    ));
    repository.activeMember.mockImplementation((organizationId: string, id: string) => Promise.resolve(
      organizationId === ORG_A && id === MEMBERSHIP_A ? { id, userId: "user-a" } : null,
    ));
    repository.update.mockResolvedValue({ count: 0 });
    repository.archive.mockResolvedValue({ count: 0 });
    repository.restore.mockResolvedValue({ count: 0 });
    repository.updateTask.mockResolvedValue({ count: 0 });
    repository.archiveTask.mockResolvedValue({ count: 0 });
    repository.removeMember.mockResolvedValue({ count: 0 });
  });

  it("does not list or reveal another organization's project", async () => {
    const service = new ProjectService(repository as never);
    await expect(service.list(ORG_B, false)).resolves.toEqual([]);
    await expect(service.get(ORG_B, PROJECT_A)).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
    expect(repository.list).toHaveBeenCalledWith(ORG_B, false);
    expect(repository.find).toHaveBeenCalledWith(ORG_B, PROJECT_A, false);
  });

  it("cannot update, archive, or restore another organization's project", async () => {
    const service = new ProjectService(repository as never);
    await expect(service.update(ORG_B, USER_B, PROJECT_A, projectInput)).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
    await expect(service.archive(ORG_B, USER_B, PROJECT_A)).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
    await expect(service.restore(ORG_B, USER_B, PROJECT_A)).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
    expect(repository.update).toHaveBeenCalledWith(ORG_B, PROJECT_A, USER_B, projectInput);
    expect(repository.archive).toHaveBeenCalledWith(ORG_B, PROJECT_A, USER_B);
    expect(repository.restore).toHaveBeenCalledWith(ORG_B, PROJECT_A, USER_B);
  });

  it("cannot create a project connected to another organization's customer", async () => {
    const service = new ProjectService(repository as never);
    await expect(service.create(ORG_B, USER_B, { ...projectInput, customerId: CUSTOMER_A })).rejects.toMatchObject({ statusCode: 404, code: "CUSTOMER_NOT_FOUND" });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("cannot list or create tasks through another organization's project", async () => {
    const service = new ProjectService(repository as never);
    await expect(service.tasks(ORG_B, PROJECT_A)).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
    await expect(service.createTask(ORG_B, USER_B, PROJECT_A, taskInput)).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
    expect(repository.tasks).not.toHaveBeenCalled();
    expect(repository.createTask).not.toHaveBeenCalled();
  });

  it("scopes task updates and deletion by organization and parent project", async () => {
    const service = new ProjectService(repository as never);
    await expect(service.updateTask(ORG_B, USER_B, PROJECT_A, "task-a", taskInput)).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
    await expect(service.archiveTask(ORG_B, USER_B, PROJECT_A, "task-a")).rejects.toMatchObject({ statusCode: 404, code: "TASK_NOT_FOUND" });
    expect(repository.updateTask).not.toHaveBeenCalled();
    expect(repository.archiveTask).toHaveBeenCalledWith(ORG_B, PROJECT_A, "task-a", USER_B);
  });

  it("rejects an assignee membership from another organization", async () => {
    repository.find.mockResolvedValue({ id: "project-b", organizationId: ORG_B });
    const service = new ProjectService(repository as never);
    await expect(service.createTask(ORG_B, USER_B, "project-b", { ...taskInput, assignedMembershipId: MEMBERSHIP_A })).rejects.toMatchObject({ statusCode: 404, code: "MEMBER_NOT_FOUND" });
    expect(repository.activeMember).toHaveBeenCalledWith(ORG_B, MEMBERSHIP_A);
    expect(repository.createTask).not.toHaveBeenCalled();
  });

  it("cannot list or add members through another organization's project", async () => {
    const service = new ProjectService(repository as never);
    await expect(service.members(ORG_B, PROJECT_A)).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
    await expect(service.addMember(ORG_B, USER_B, PROJECT_A, { employeeId: EMPLOYEE_A, role: "CONTRIBUTOR", roleLabel: "Developer" })).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
    expect(repository.members).not.toHaveBeenCalled();
    expect(repository.addMember).not.toHaveBeenCalled();
  });

  it("rejects another organization's employee even for a valid local project", async () => {
    repository.find.mockResolvedValue({ id: "project-b", organizationId: ORG_B });
    const service = new ProjectService(repository as never);
    await expect(service.addMember(ORG_B, USER_B, "project-b", { employeeId: EMPLOYEE_A, role: "VIEWER", roleLabel: "Reviewer" })).rejects.toMatchObject({ statusCode: 404, code: "EMPLOYEE_NOT_FOUND" });
    expect(repository.activeEmployee).toHaveBeenCalledWith(ORG_B, EMPLOYEE_A);
    expect(repository.addMember).not.toHaveBeenCalled();
  });

  it("scopes project-member removal by organization and project", async () => {
    const service = new ProjectService(repository as never);
    await expect(service.removeMember(ORG_B, USER_B, PROJECT_A, "project-member-a")).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_MEMBER_NOT_FOUND" });
    expect(repository.removeMember).toHaveBeenCalledWith(ORG_B, PROJECT_A, "project-member-a", USER_B);
  });
});
