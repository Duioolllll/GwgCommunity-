/** SVGs and motion adapted from Lucide and Lucide Animated; see licenses/README.md. */
export function ServiceIcon({ kind }: { kind: "market" | "clubs" | "finder" }) {
  return <svg className={`service-icon service-icon-${kind}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "market" && <><path d="M16 10a4 4 0 0 1-8 0" /><path d="M3.103 6.034h17.794" /><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" /></>}
    {kind === "clubs" && <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><g className="service-icon-companion"><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></g></>}
    {kind === "finder" && <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>}
  </svg>;
}
