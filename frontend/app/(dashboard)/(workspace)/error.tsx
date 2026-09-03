"use client";
export default function WorkspaceError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <section className="dashboard-notice error" role="alert"><strong>Unable to open this workspace.</strong><p>Please try again.</p><button type="button" onClick={reset}>Try again</button></section>;
}
