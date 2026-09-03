import { CustomerWorkspace } from "@/features/customers/customer-workspace";
export default async function CustomerPage({ params }: { params: Promise<{ customerId: string }> }) { const { customerId } = await params; return <CustomerWorkspace selectedCustomerId={customerId} />; }
