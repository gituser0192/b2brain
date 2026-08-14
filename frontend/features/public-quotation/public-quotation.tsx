"use client";

import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/services/api-client";

interface Quote { quotationNumber:string;status:string;issueDate:string;validUntil:string;currency:string;subtotal:string;discount:string;tax:string;total:string;notes:string|null;terms:string|null;organization:{name:string};customer:{displayName:string};items:{id:string;description:string;quantity:string;unitPrice:string;amount:string}[] }
interface Response { success:true;data:Quote }
export function PublicQuotation({token}:{token:string}) {
  const [quote,setQuote]=useState<Quote|null>(null),[error,setError]=useState(""),[note,setNote]=useState(""),[notice,setNotice]=useState("");
  useEffect(()=>{void apiRequest<Response>(`/public/quotations/${encodeURIComponent(token)}`).then(result=>setQuote(result.data)).catch(reason=>setError(reason instanceof ApiError?reason.message:"Unable to load quotation."))},[token]);
  async function decide(decision:"ACCEPTED"|"REJECTED") {try{const result=await apiRequest<Response>(`/public/quotations/${encodeURIComponent(token)}/decision`,{method:"POST",body:JSON.stringify({decision,note:note||null})});setQuote(result.data);setNotice(`Quotation ${decision.toLowerCase()}.`)}catch(reason){setError(reason instanceof ApiError?reason.message:"Unable to record response.")}}
  const money=(value:string)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:quote?.currency??"INR"}).format(Number(value));
  if(error&&!quote)return <main className="public-quote-shell"><div className="public-quote-error">{error}</div></main>;
  if(!quote)return <main className="public-quote-shell"><div>Loading quotation…</div></main>;
  return <main className="public-quote-shell"><article className="public-quote">
    <header><div><span>B² BRAIN · COMMERCIAL PROPOSAL</span><h1>{quote.organization.name}</h1><p>Quotation {quote.quotationNumber}</p></div><div><b>{quote.status}</b><small>Valid until {new Date(quote.validUntil).toLocaleDateString()}</small></div></header>
    {notice&&<div className="public-form-notice success">{notice}</div>}{error&&<div className="public-form-notice error">{error}</div>}
    <section className="quote-address"><div><small>PREPARED FOR</small><strong>{quote.customer.displayName}</strong></div><div><small>ISSUED</small><strong>{new Date(quote.issueDate).toLocaleDateString()}</strong></div></section>
    <table><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{quote.items.map(item=><tr key={item.id}><td>{item.description}</td><td>{Number(item.quantity)}</td><td>{money(item.unitPrice)}</td><td>{money(item.amount)}</td></tr>)}</tbody></table>
    <section className="quote-summary"><div>{quote.notes&&<><small>NOTES</small><p>{quote.notes}</p></>}{quote.terms&&<><small>TERMS</small><p>{quote.terms}</p></>}</div><dl><div><dt>Subtotal</dt><dd>{money(quote.subtotal)}</dd></div><div><dt>Discount</dt><dd>- {money(quote.discount)}</dd></div><div><dt>Tax</dt><dd>{money(quote.tax)}</dd></div><div className="total"><dt>Total</dt><dd>{money(quote.total)}</dd></div></dl></section>
    {quote.status==="SENT"&&<section className="quote-decision"><textarea rows={2} placeholder="Optional response note" value={note} onChange={event=>setNote(event.target.value)}/><div><button className="reject" onClick={()=>void decide("REJECTED")}>Reject quotation</button><button onClick={()=>void decide("ACCEPTED")}>Accept quotation</button></div></section>}
    <footer><span>Generated securely by B² Brain</span><button onClick={()=>window.print()}>Print / Save PDF</button></footer>
  </article></main>;
}
