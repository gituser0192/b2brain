import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const permissions = [
  { code: "ORGANIZATION_VIEW", name: "View organization", description: "View organization profile and preferences" },
  { code: "ORGANIZATION_UPDATE", name: "Update organization", description: "Update organization preferences" },
  { code: "MEMBERSHIP_VIEW", name: "View memberships", description: "View members and pending invitations" },
  { code: "MEMBERSHIP_MANAGE", name: "Manage memberships", description: "Invite, assign, suspend, and remove members" },
  { code: "ROLE_VIEW", name: "View roles", description: "View role and permission definitions" },
  { code: "ROLE_MANAGE", name: "Manage roles", description: "Create and edit organization-owned roles" },
  { code: "SERVICE_CATALOG_VIEW", name: "View service catalogue", description: "Platform-only service catalogue access" },
  { code: "ORGANIZATION_SERVICE_MANAGE", name: "Manage organization services", description: "Platform-only organization service assignment" },
  { code: "PLATFORM_SERVICE_MANAGE", name: "Manage platform services", description: "Platform-only service catalogue configuration" },
  { code: "CRM_VIEW", name: "View CRM customers", description: "View customer records in the CRM service" },
  { code: "CRM_CREATE", name: "Create CRM customers", description: "Create customer records in the CRM service" },
  { code: "CRM_UPDATE", name: "Update CRM customers", description: "Edit customer records in the CRM service" },
  { code: "CRM_ARCHIVE", name: "Archive CRM customers", description: "Archive and restore customer records in the CRM service" },
  { code: "CRM_DELETE", name: "Permanently delete CRM customers", description: "Permanently delete customer records after they are archived" },
  { code: "CRM_ACTIVITY_VIEW", name: "View CRM activities", description: "View customer communication and activity history" },
  { code: "CRM_ACTIVITY_MANAGE", name: "Manage CRM activities", description: "Log and archive customer calls, emails, meetings, and notes" },
  { code: "CRM_FOLLOWUP_MANAGE", name: "Manage CRM follow-ups", description: "Schedule, complete, cancel, and archive customer follow-ups" },
  { code: "AUTOMATION_VIEW", name: "View automation foundation", description: "View the organization's automation, agent, notification, and integration foundation" },
  { code: "AUTOMATION_MANAGE", name: "Manage automation foundation", description: "Configure organization-owned agents, workflows, notifications, and integrations" },
  { code: "NOTIFICATION_VIEW", name: "View notifications", description: "View and manage personal organization notifications" },
  { code: "PROJECT_VIEW", name: "View projects", description: "View organization projects" },
  { code: "PROJECT_CREATE", name: "Create projects", description: "Create organization projects" },
  { code: "PROJECT_UPDATE", name: "Update projects", description: "Update organization projects" },
  { code: "PROJECT_ARCHIVE", name: "Archive projects", description: "Archive and restore organization projects" },
  { code: "TASK_VIEW", name: "View project tasks", description: "View tasks within accessible projects" },
  { code: "TASK_MANAGE", name: "Manage project tasks", description: "Create, update, and archive project tasks" },
  { code: "EMPLOYEE_VIEW", name: "View employees", description: "View the organization employee directory" },
  { code: "EMPLOYEE_MANAGE", name: "Manage employees", description: "Create and maintain organization employee records" },
  { code: "DEAL_VIEW", name: "View sales deals", description: "View sales pipeline deals and calculated metrics" },
  { code: "DEAL_MANAGE", name: "Manage sales deals", description: "Create, update, win, lose, archive, and restore sales deals" },
  { code: "FINANCE_VIEW", name: "View finance", description: "View invoices, payments, expenses, and finance metrics" },
  { code: "FINANCE_MANAGE", name: "Manage finance", description: "Create invoices and record payments and expenses" },
  { code: "CATALOGUE_VIEW", name: "View catalogue", description: "View organization products, services, prices, and variants" },
  { code: "CATALOGUE_MANAGE", name: "Manage catalogue", description: "Create and maintain organization products and services" },
  { code: "ORDER_VIEW", name: "View orders", description: "View organization orders, line items, totals, and fulfilment state" },
  { code: "ORDER_MANAGE", name: "Manage orders", description: "Create, update, progress, archive, and restore organization orders" },
  { code: "INVENTORY_VIEW", name: "View inventory", description: "View warehouses, stock balances, reservations, alerts, and movement history" },
  { code: "INVENTORY_MANAGE", name: "Manage inventory", description: "Create warehouses and record controlled stock movements" },
  { code: "MARKETING_VIEW", name: "View marketing", description: "View campaigns, attributed leads, spend, conversion, and return metrics" },
  { code: "MARKETING_MANAGE", name: "Manage marketing", description: "Create and maintain campaigns and CRM lead attribution" },
  { code: "ANALYSIS_VIEW", name: "View business analysis", description: "View evidence-based comparisons, health scores, risks, and recommendations" },
  { code: "SUPPORT_VIEW", name: "View customer support", description: "View organization support tickets, conversations, deadlines, and service metrics" },
  { code: "SUPPORT_MANAGE", name: "Manage customer support", description: "Create, assign, reply to, resolve, archive, and restore support tickets" },
  { code: "WEBSITE_VIEW", name: "View managed websites", description: "View websites, change requests, approvals, and deployment history" },
  { code: "WEBSITE_MANAGE", name: "Manage websites", description: "Register websites and maintain change requests" },
  { code: "WEBSITE_APPROVE", name: "Approve website changes", description: "Approve or reject website changes before production deployment" },
  { code: "WEBSITE_DEPLOY", name: "Record website deployments", description: "Create controlled preview, staging, and approved production deployment records" },
  { code: "PROCUREMENT_VIEW", name: "View procurement", description: "View vendors, purchase orders, receipts, commitments, and delivery performance" },
  { code: "PROCUREMENT_MANAGE", name: "Manage procurement", description: "Create vendors and prepare purchase orders" },
  { code: "PROCUREMENT_APPROVE", name: "Approve purchase orders", description: "Approve or return purchase orders before supplier ordering" },
  { code: "PROCUREMENT_RECEIVE", name: "Receive purchased goods", description: "Record controlled goods receipts and update inventory" },
  { code: "CALENDAR_VIEW", name: "View calendar", description: "View organization appointments, meetings, attendees, reminders, and linked business context" },
  { code: "CALENDAR_MANAGE", name: "Manage calendar", description: "Create, edit, complete, cancel, and archive calendar events" },
  { code: "INQUIRY_VIEW", name: "View inquiries", description: "View organization inquiries, classifications, matches, and conversion history" },
  { code: "INQUIRY_MANAGE", name: "Manage inquiries", description: "Capture, classify, assign, respond to, and archive organization inquiries" },
  { code: "INQUIRY_CONVERT", name: "Convert inquiries", description: "Explicitly convert qualified inquiries into CRM customers, sales deals, or support tickets" },
  { code: "STAY_VIEW", name: "View PG and hostel operations", description: "View properties, rooms, beds, residents, occupancies, rent and collection metrics" },
  { code: "STAY_MANAGE", name: "Manage PG and hostel operations", description: "Manage properties, rooms, residents, check-ins, rent generation, payments and checkouts" },
  { code: "APPROVAL_VIEW", name: "View approvals", description: "View organization approval requests and decisions" },
  { code: "APPROVAL_DECIDE", name: "Decide approvals", description: "Approve, reject, or return controlled organization actions" },
  { code: "AUDIT_VIEW", name: "View audit history", description: "View immutable organization action and decision history" },
] as const;
const roles = [
  { code: "ORGANIZATION_OWNER", name: "Organization Owner", description: "Owner of a customer organization", permissionCodes: ["ORGANIZATION_VIEW", "ORGANIZATION_UPDATE", "MEMBERSHIP_VIEW", "MEMBERSHIP_MANAGE", "ROLE_VIEW", "ROLE_MANAGE", "CRM_VIEW", "CRM_CREATE", "CRM_UPDATE", "CRM_ARCHIVE", "CRM_DELETE", "CRM_ACTIVITY_VIEW", "CRM_ACTIVITY_MANAGE", "CRM_FOLLOWUP_MANAGE", "AUTOMATION_VIEW", "AUTOMATION_MANAGE", "NOTIFICATION_VIEW", "PROJECT_VIEW", "PROJECT_CREATE", "PROJECT_UPDATE", "PROJECT_ARCHIVE", "TASK_VIEW", "TASK_MANAGE"] },
  { code: "ORGANIZATION_ADMIN", name: "Organization Admin", description: "Manages organization settings and members", permissionCodes: ["ORGANIZATION_VIEW", "ORGANIZATION_UPDATE", "MEMBERSHIP_VIEW", "MEMBERSHIP_MANAGE", "ROLE_VIEW", "CRM_VIEW", "CRM_CREATE", "CRM_UPDATE", "CRM_ARCHIVE", "CRM_DELETE", "CRM_ACTIVITY_VIEW", "CRM_ACTIVITY_MANAGE", "CRM_FOLLOWUP_MANAGE", "AUTOMATION_VIEW", "AUTOMATION_MANAGE", "NOTIFICATION_VIEW", "PROJECT_VIEW", "PROJECT_CREATE", "PROJECT_UPDATE", "PROJECT_ARCHIVE", "TASK_VIEW", "TASK_MANAGE"] },
  { code: "ORGANIZATION_MANAGER", name: "Manager", description: "Views the organization and team", permissionCodes: ["ORGANIZATION_VIEW", "MEMBERSHIP_VIEW", "ROLE_VIEW", "CRM_VIEW", "CRM_CREATE", "CRM_UPDATE", "CRM_ACTIVITY_VIEW", "CRM_ACTIVITY_MANAGE", "CRM_FOLLOWUP_MANAGE", "NOTIFICATION_VIEW", "PROJECT_VIEW", "PROJECT_CREATE", "PROJECT_UPDATE", "TASK_VIEW", "TASK_MANAGE"] },
  { code: "ORGANIZATION_MEMBER", name: "Member", description: "Standard organization member", permissionCodes: ["ORGANIZATION_VIEW", "CRM_VIEW", "CRM_ACTIVITY_VIEW", "NOTIFICATION_VIEW", "PROJECT_VIEW", "TASK_VIEW"] },
] as const;

function employeePermissions(roleCode: string) {
  if (roleCode === "ORGANIZATION_OWNER" || roleCode === "ORGANIZATION_ADMIN") return ["EMPLOYEE_VIEW", "EMPLOYEE_MANAGE"] as const;
  return ["EMPLOYEE_VIEW"] as const;
}
function salesPermissions(roleCode: string) { return roleCode === "ORGANIZATION_MEMBER" ? ["DEAL_VIEW"] as const : ["DEAL_VIEW", "DEAL_MANAGE"] as const; }
function financePermissions(roleCode: string) { return roleCode === "ORGANIZATION_OWNER" || roleCode === "ORGANIZATION_ADMIN" ? ["FINANCE_VIEW", "FINANCE_MANAGE"] as const : ["FINANCE_VIEW"] as const; }
function cataloguePermissions(roleCode: string) { return roleCode === "ORGANIZATION_MEMBER" ? ["CATALOGUE_VIEW"] as const : ["CATALOGUE_VIEW", "CATALOGUE_MANAGE"] as const; }
function orderPermissions(roleCode: string) { return roleCode === "ORGANIZATION_MEMBER" ? ["ORDER_VIEW"] as const : ["ORDER_VIEW", "ORDER_MANAGE"] as const; }
function inventoryPermissions(roleCode: string) { return roleCode === "ORGANIZATION_MEMBER" ? ["INVENTORY_VIEW"] as const : ["INVENTORY_VIEW", "INVENTORY_MANAGE"] as const; }
function marketingPermissions(roleCode: string) { return roleCode === "ORGANIZATION_MEMBER" ? ["MARKETING_VIEW"] as const : ["MARKETING_VIEW", "MARKETING_MANAGE"] as const; }
function analysisPermissions() { return ["ANALYSIS_VIEW"] as const; }
function supportPermissions(roleCode: string) { return roleCode === "ORGANIZATION_MEMBER" ? ["SUPPORT_VIEW"] as const : ["SUPPORT_VIEW", "SUPPORT_MANAGE"] as const; }
function websitePermissions(roleCode: string) { if(roleCode==="ORGANIZATION_MEMBER")return ["WEBSITE_VIEW"] as const;if(roleCode==="ORGANIZATION_MANAGER")return ["WEBSITE_VIEW","WEBSITE_MANAGE","WEBSITE_DEPLOY"] as const;return ["WEBSITE_VIEW","WEBSITE_MANAGE","WEBSITE_APPROVE","WEBSITE_DEPLOY"] as const; }
function procurementPermissions(roleCode: string) { if(roleCode==="ORGANIZATION_MEMBER")return ["PROCUREMENT_VIEW"] as const;if(roleCode==="ORGANIZATION_MANAGER")return ["PROCUREMENT_VIEW","PROCUREMENT_MANAGE","PROCUREMENT_RECEIVE"] as const;return ["PROCUREMENT_VIEW","PROCUREMENT_MANAGE","PROCUREMENT_APPROVE","PROCUREMENT_RECEIVE"] as const; }
function calendarPermissions(roleCode: string) { return roleCode==="ORGANIZATION_MEMBER"?["CALENDAR_VIEW"] as const:["CALENDAR_VIEW","CALENDAR_MANAGE"] as const; }
function inquiryPermissions(roleCode: string) { return roleCode==="ORGANIZATION_MEMBER"?["INQUIRY_VIEW"] as const:["INQUIRY_VIEW","INQUIRY_MANAGE","INQUIRY_CONVERT"] as const; }
function stayPermissions(roleCode: string) { return roleCode==="ORGANIZATION_MEMBER"?["STAY_VIEW"] as const:["STAY_VIEW","STAY_MANAGE"] as const; }
function governancePermissions(roleCode: string) { if(roleCode==="ORGANIZATION_MEMBER")return [] as const;if(roleCode==="ORGANIZATION_OWNER"||roleCode==="ORGANIZATION_ADMIN")return ["APPROVAL_VIEW","APPROVAL_DECIDE","AUDIT_VIEW"] as const;return ["APPROVAL_VIEW","AUDIT_VIEW"] as const; }

async function seed() {
  const permissionMap = new Map<string, string>();
  for (const item of permissions) {
    const permission = await prisma.permission.upsert({ where: { code: item.code }, update: { name: item.name, description: item.description }, create: item });
    permissionMap.set(item.code, permission.id);
  }
  for (const item of roles) {
    const permissionCodes = [...item.permissionCodes, ...employeePermissions(item.code), ...salesPermissions(item.code), ...financePermissions(item.code), ...cataloguePermissions(item.code), ...orderPermissions(item.code), ...inventoryPermissions(item.code), ...marketingPermissions(item.code), ...analysisPermissions(), ...supportPermissions(item.code), ...websitePermissions(item.code), ...procurementPermissions(item.code), ...calendarPermissions(item.code), ...inquiryPermissions(item.code), ...stayPermissions(item.code), ...governancePermissions(item.code)];
    const current = await prisma.role.findFirst({ where: { organizationId: null, code: item.code, isSystem: true } });
    const role = current
      ? await prisma.role.update({ where: { id: current.id }, data: { name: item.name, description: item.description } })
      : await prisma.role.create({ data: { organizationId: null, code: item.code, name: item.name, description: item.description, isSystem: true } });
    for (const code of permissionCodes) {
      const permissionId = permissionMap.get(code);
      if (permissionId) await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId } }, update: {}, create: { roleId: role.id, permissionId } });
    }
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permission: { code: { notIn: permissionCodes } } } });
  }
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (superAdminEmail) await prisma.user.updateMany({ where: { email: superAdminEmail, status: "ACTIVE", deletedAt: null }, data: { isPlatformAdmin: true } });
  await prisma.service.upsert({
    where: { code: "CRM" },
    update: { name: "CRM & Customer Management", description: "Manage customer relationships, contacts, status, and account details.", status: "ACTIVE", iconKey: "C", routePath: "/dashboard?view=crm", sortOrder: 10, archivedAt: null },
    create: { code: "CRM", name: "CRM & Customer Management", description: "Manage customer relationships, contacts, status, and account details.", status: "ACTIVE", iconKey: "C", routePath: "/dashboard?view=crm", sortOrder: 10 },
  });
  await prisma.service.upsert({
    where: { code: "AUTOMATION" },
    update: { name: "Automation & AI Foundation", description: "Controlled foundation for notifications, agents, workflows, and external provider connections.", status: "ACTIVE", iconKey: "A", routePath: "/dashboard?view=automation", sortOrder: 90, archivedAt: null },
    create: { code: "AUTOMATION", name: "Automation & AI Foundation", description: "Controlled foundation for notifications, agents, workflows, and external provider connections.", status: "ACTIVE", iconKey: "A", routePath: "/dashboard?view=automation", sortOrder: 90 },
  });
  await prisma.service.upsert({
    where: { code: "PROJECTS" },
    update: { name: "Projects & Task Management", description: "Plan customer and internal projects, assign responsibilities, track deadlines, and manage delivery.", status: "ACTIVE", iconKey: "P", routePath: "/dashboard?view=projects", sortOrder: 20, archivedAt: null },
    create: { code: "PROJECTS", name: "Projects & Task Management", description: "Plan customer and internal projects, assign responsibilities, track deadlines, and manage delivery.", status: "ACTIVE", iconKey: "P", routePath: "/dashboard?view=projects", sortOrder: 20 },
  });
  await prisma.service.upsert({
    where: { code: "PEOPLE" },
    update: { name: "People & Employee Management", description: "Maintain employee records, departments, employment details, reporting lines, and optional workspace-account links.", status: "ACTIVE", iconKey: "E", routePath: "/dashboard?view=employees", sortOrder: 30, archivedAt: null },
    create: { code: "PEOPLE", name: "People & Employee Management", description: "Maintain employee records, departments, employment details, reporting lines, and optional workspace-account links.", status: "ACTIVE", iconKey: "E", routePath: "/dashboard?view=employees", sortOrder: 30 },
  });
  await prisma.service.upsert({
    where: { code: "SALES" },
    update: { name: "Sales Pipeline & Deals", description: "Track opportunities, expected revenue, win probability, close dates, and sales outcomes.", status: "ACTIVE", iconKey: "S", routePath: "/dashboard?view=sales", sortOrder: 15, archivedAt: null },
    create: { code: "SALES", name: "Sales Pipeline & Deals", description: "Track opportunities, expected revenue, win probability, close dates, and sales outcomes.", status: "ACTIVE", iconKey: "S", routePath: "/dashboard?view=sales", sortOrder: 15 },
  });
  await prisma.service.upsert({where:{code:"FINANCE"},update:{name:"Finance & Revenue",description:"Invoices, payments, expenses, balances, and cash metrics.",status:"ACTIVE",iconKey:"F",routePath:"/dashboard?view=finance",sortOrder:40,archivedAt:null},create:{code:"FINANCE",name:"Finance & Revenue",description:"Invoices, payments, expenses, balances, and cash metrics.",status:"ACTIVE",iconKey:"F",routePath:"/dashboard?view=finance",sortOrder:40}});
  await prisma.service.upsert({where:{code:"CATALOGUE"},update:{name:"Products & Services Catalogue",description:"Shared products, services, pricing, costs, taxes, billing rules, and variants.",status:"ACTIVE",iconKey:"G",routePath:"/dashboard?view=catalogue",sortOrder:12,archivedAt:null},create:{code:"CATALOGUE",name:"Products & Services Catalogue",description:"Shared products, services, pricing, costs, taxes, billing rules, and variants.",status:"ACTIVE",iconKey:"G",routePath:"/dashboard?view=catalogue",sortOrder:12}});
  await prisma.service.upsert({where:{code:"ORDERS"},update:{name:"Orders & Fulfilment",description:"Customer orders, catalogue line items, server-calculated totals, status progression, and fulfilment.",status:"ACTIVE",iconKey:"O",routePath:"/dashboard?view=orders",sortOrder:25,archivedAt:null},create:{code:"ORDERS",name:"Orders & Fulfilment",description:"Customer orders, catalogue line items, server-calculated totals, status progression, and fulfilment.",status:"ACTIVE",iconKey:"O",routePath:"/dashboard?view=orders",sortOrder:25}});
  await prisma.service.upsert({where:{code:"INVENTORY"},update:{name:"Inventory & Stock Management",description:"Warehouses, stock balances, reservations, movement history, low-stock visibility, and order fulfilment deductions.",status:"ACTIVE",iconKey:"I",routePath:"/dashboard?view=inventory",sortOrder:26,archivedAt:null},create:{code:"INVENTORY",name:"Inventory & Stock Management",description:"Warehouses, stock balances, reservations, movement history, low-stock visibility, and order fulfilment deductions.",status:"ACTIVE",iconKey:"I",routePath:"/dashboard?view=inventory",sortOrder:26}});
  await prisma.service.upsert({where:{code:"MARKETING"},update:{name:"Marketing & Campaign Management",description:"Plan campaigns, record real channel performance, attribute CRM leads and won deals, and measure return on spend.",status:"ACTIVE",iconKey:"M",routePath:"/dashboard?view=marketing",sortOrder:35,archivedAt:null},create:{code:"MARKETING",name:"Marketing & Campaign Management",description:"Plan campaigns, record real channel performance, attribute CRM leads and won deals, and measure return on spend.",status:"ACTIVE",iconKey:"M",routePath:"/dashboard?view=marketing",sortOrder:35}});
  await prisma.service.upsert({where:{code:"BUSINESS_ANALYSIS"},update:{name:"Business Analysis & Insights",description:"Evidence-based period comparisons, transparent health scoring, risks, and prioritized recommendations.",status:"ACTIVE",iconKey:"B",routePath:"/dashboard?view=analysis",sortOrder:45,archivedAt:null},create:{code:"BUSINESS_ANALYSIS",name:"Business Analysis & Insights",description:"Evidence-based period comparisons, transparent health scoring, risks, and prioritized recommendations.",status:"ACTIVE",iconKey:"B",routePath:"/dashboard?view=analysis",sortOrder:45}});
  await prisma.service.upsert({where:{code:"ACTION_CENTRE"},update:{name:"Business Action Centre",description:"Evidence-based operational recommendations, controlled execution, dismissal reasons, and measured action history.",status:"ACTIVE",iconKey:"!",routePath:"/dashboard?view=actions",sortOrder:46,archivedAt:null},create:{code:"ACTION_CENTRE",name:"Business Action Centre",description:"Evidence-based operational recommendations, controlled execution, dismissal reasons, and measured action history.",status:"ACTIVE",iconKey:"!",routePath:"/dashboard?view=actions",sortOrder:46}});
  await prisma.service.upsert({where:{code:"GOVERNANCE"},update:{name:"Approvals & Audit",description:"Controlled approval decisions and immutable organization audit history for sensitive business actions.",status:"ACTIVE",iconKey:"A",routePath:"/dashboard?view=governance",sortOrder:47,archivedAt:null},create:{code:"GOVERNANCE",name:"Approvals & Audit",description:"Controlled approval decisions and immutable organization audit history for sensitive business actions.",status:"ACTIVE",iconKey:"A",routePath:"/dashboard?view=governance",sortOrder:47}});
  await prisma.service.upsert({where:{code:"SUPPORT"},update:{name:"Customer Support & Tickets",description:"Customer tickets, assignment, response and resolution deadlines, conversations, satisfaction, and service metrics.",status:"ACTIVE",iconKey:"U",routePath:"/dashboard?view=support",sortOrder:32,archivedAt:null},create:{code:"SUPPORT",name:"Customer Support & Tickets",description:"Customer tickets, assignment, response and resolution deadlines, conversations, satisfaction, and service metrics.",status:"ACTIVE",iconKey:"U",routePath:"/dashboard?view=support",sortOrder:32}});
  await prisma.service.upsert({where:{code:"WEBSITES"},update:{name:"Website Management & Development",description:"Website registry, controlled change requests, explicit approvals, deployment records, verification, and rollback planning.",status:"ACTIVE",iconKey:"W",routePath:"/dashboard?view=websites",sortOrder:34,archivedAt:null},create:{code:"WEBSITES",name:"Website Management & Development",description:"Website registry, controlled change requests, explicit approvals, deployment records, verification, and rollback planning.",status:"ACTIVE",iconKey:"W",routePath:"/dashboard?view=websites",sortOrder:34}});
  await prisma.service.upsert({where:{code:"PROCUREMENT"},update:{name:"Procurement & Vendor Management",description:"Vendors, approved purchase orders, partial goods receipts, inventory updates, supplier references, and delivery control.",status:"ACTIVE",iconKey:"V",routePath:"/dashboard?view=procurement",sortOrder:28,archivedAt:null},create:{code:"PROCUREMENT",name:"Procurement & Vendor Management",description:"Vendors, approved purchase orders, partial goods receipts, inventory updates, supplier references, and delivery control.",status:"ACTIVE",iconKey:"V",routePath:"/dashboard?view=procurement",sortOrder:28}});
  await prisma.service.upsert({where:{code:"CALENDAR"},update:{name:"Calendar, Appointments & Scheduling",description:"Customer appointments, internal meetings, linked business context, employee conflict detection, and reminder configuration.",status:"ACTIVE",iconKey:"K",routePath:"/dashboard?view=calendar",sortOrder:18,archivedAt:null},create:{code:"CALENDAR",name:"Calendar, Appointments & Scheduling",description:"Customer appointments, internal meetings, linked business context, employee conflict detection, and reminder configuration.",status:"ACTIVE",iconKey:"K",routePath:"/dashboard?view=calendar",sortOrder:18}});
  await prisma.service.upsert({where:{code:"LEADS"},update:{name:"Lead & Inquiry Management",description:"Capture every inquiry, detect existing customers, classify intent, assign ownership, and control conversion into CRM, sales, or support.",status:"ACTIVE",iconKey:"Q",routePath:"/dashboard?view=inquiries",sortOrder:8,archivedAt:null},create:{code:"LEADS",name:"Lead & Inquiry Management",description:"Capture every inquiry, detect existing customers, classify intent, assign ownership, and control conversion into CRM, sales, or support.",status:"ACTIVE",iconKey:"Q",routePath:"/dashboard?view=inquiries",sortOrder:8}});
  await prisma.service.upsert({where:{code:"STAY"},update:{name:"B² Stay — PG & Hostel Management",description:"Properties, rooms, beds, residents, occupancy agreements, monthly rent, collections, vacancy and checkout control.",status:"ACTIVE",iconKey:"H",routePath:"/dashboard?view=stay",sortOrder:14,archivedAt:null},create:{code:"STAY",name:"B² Stay — PG & Hostel Management",description:"Properties, rooms, beds, residents, occupancy agreements, monthly rent, collections, vacancy and checkout control.",status:"ACTIVE",iconKey:"H",routePath:"/dashboard?view=stay",sortOrder:14}});
}

seed().finally(() => prisma.$disconnect());
