import { Suspense } from "react";
import { SuperAdminConsole } from "@/features/platform/super-admin-console";

export default function SuperAdminPage() {
  return <Suspense fallback={<main className="screen-loader"><span className="spinner dark" /><p>Opening secure platform console…</p></main>}><SuperAdminConsole /></Suspense>;
}
