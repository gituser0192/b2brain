import { AppError } from "../../shared/errors/app-error.js";
import { CustomerRepository, type CustomerRecord } from "./customer.repository.js";
import type { CreateCustomerInput, ListCustomerQuery, UpdateCustomerInput } from "./customer.validation.js";

function displayName(input: CreateCustomerInput) {
  return input.type === "COMPANY" ? input.companyName! : [input.firstName, input.lastName].filter(Boolean).join(" ");
}
function safeCustomer(customer: NonNullable<CustomerRecord>) {
  return customer;
}

export class CustomerService {
  constructor(private readonly repository = new CustomerRepository()) {}
  async list(organizationId: string, query: ListCustomerQuery) {
    const result = await this.repository.list(organizationId, query);
    return { customers: result.items.map(safeCustomer), pagination: { page: query.page, pageSize: query.pageSize, total: result.total, pages: Math.ceil(result.total / query.pageSize) } };
  }
  async get(organizationId: string, id: string) {
    const customer = await this.repository.find(organizationId, id, true);
    if (!customer) throw new AppError(404, "Customer was not found.", "CUSTOMER_NOT_FOUND");
    return safeCustomer(customer);
  }
  create(organizationId: string, actorUserId: string, input: CreateCustomerInput) {
    return this.repository.create({ organizationId, createdById: actorUserId, updatedById: actorUserId, displayName: displayName(input), ...input });
  }
  async update(organizationId: string, actorUserId: string, id: string, input: UpdateCustomerInput) {
    if (!await this.repository.find(organizationId, id)) throw new AppError(404, "Customer was not found.", "CUSTOMER_NOT_FOUND");
    return this.repository.update(organizationId, id, { ...input, displayName: displayName(input), updatedById: actorUserId });
  }
  async archive(organizationId: string, actorUserId: string, id: string) {
    if ((await this.repository.archive(organizationId, id, actorUserId)).count !== 1) throw new AppError(404, "Customer was not found.", "CUSTOMER_NOT_FOUND");
  }
  async restore(organizationId: string, actorUserId: string, id: string) {
    if ((await this.repository.restore(organizationId, id, actorUserId)).count !== 1) throw new AppError(404, "Archived customer was not found.", "CUSTOMER_NOT_FOUND");
  }
  async permanentlyDelete(organizationId: string, id: string) {
    if ((await this.repository.permanentlyDelete(organizationId, id)).count !== 1) throw new AppError(404, "Archived customer was not found.", "CUSTOMER_NOT_FOUND");
  }
}
