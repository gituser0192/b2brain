import { WebsiteLeadForm } from "@/features/public-form/website-lead-form";

export default async function WebsiteFormPage({ params }: { params: Promise<{ formKey: string }> }) {
  const { formKey } = await params;
  return <WebsiteLeadForm formKey={formKey} />;
}
