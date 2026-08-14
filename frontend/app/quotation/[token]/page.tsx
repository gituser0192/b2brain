import { PublicQuotation } from "@/features/public-quotation/public-quotation";
export default async function QuotationPage({params}:{params:Promise<{token:string}>}){const{token}=await params;return <PublicQuotation token={token}/>}
