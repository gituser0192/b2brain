import { Router, type RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { success } from "../../shared/responses/api-response.js";
import { requireActiveContext,requireAuth,requireEnabledService,requirePermission } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { FinanceService } from "./finance.service.js";
import { expenseSchema,financeLedgerQuerySchema,invoiceSchema,paymentSchema,type ExpenseInput,type InvoiceInput,type PaymentInput } from "./finance.validation.js";
const s=new FinanceService();function a(r:Parameters<RequestHandler>[0]){if(!r.auth)throw new AppError(401,"Authentication required.","UNAUTHENTICATED");return r.auth}
export const financeRouter=Router();financeRouter.use(requireAuth,requireActiveContext,requireEnabledService("FINANCE"));
financeRouter.get("/",requirePermission("FINANCE_VIEW"),async(r,x)=>x.json(success(await s.list(a(r).organizationId))));
financeRouter.get("/ledger",requirePermission("FINANCE_VIEW"),async(r,x)=>x.json(success(await s.ledger(a(r).organizationId,financeLedgerQuerySchema.parse(r.query)))));
financeRouter.get("/expenses/:id",requirePermission("FINANCE_VIEW"),async(r,x)=>x.json(success(await s.getExpense(a(r).organizationId,String(r.params.id)))));
financeRouter.post("/invoices",requirePermission("FINANCE_MANAGE"),validateBody(invoiceSchema),async(r,x)=>{const c=a(r);x.status(201).json(success(await s.createInvoice(c.organizationId,c.userId,r.body as InvoiceInput),"Invoice created."))});
financeRouter.post("/invoices/:id/payments",requirePermission("FINANCE_MANAGE"),validateBody(paymentSchema),async(r,x)=>{const c=a(r);x.status(201).json(success(await s.pay(c.organizationId,c.userId,String(r.params.id),r.body as PaymentInput),"Payment recorded."))});
financeRouter.post("/invoices/:id/collection-follow-up",requirePermission("FINANCE_MANAGE"),async(r,x)=>{const c=a(r);x.status(201).json(success(await s.createCollectionFollowUp(c.organizationId,c.userId,String(r.params.id)),"Collection follow-up created."))});
financeRouter.post("/expenses",requirePermission("FINANCE_MANAGE"),validateBody(expenseSchema),async(r,x)=>{const c=a(r);x.status(201).json(success(await s.expense(c.organizationId,c.userId,r.body as ExpenseInput),"Expense recorded."))});
financeRouter.put("/expenses/:id",requirePermission("FINANCE_MANAGE"),validateBody(expenseSchema),async(r,x)=>{const c=a(r);x.json(success(await s.updateExpense(c.organizationId,c.userId,String(r.params.id),r.body as ExpenseInput),"Expense updated."))});
financeRouter.delete("/expenses/:id",requirePermission("FINANCE_MANAGE"),async(r,x)=>{const c=a(r);await s.archiveExpense(c.organizationId,c.userId,String(r.params.id));x.json(success({},"Expense archived."))});
