import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  void request;
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/admin/:path*", "/super-admin/:path*"] };
