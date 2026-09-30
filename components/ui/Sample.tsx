import { site } from "@/lib/site";

/**
 * Tags a number or claim as sample content while the concept banner is on, so a real
 * business's name never sits next to invented facts.
 */
export function Sample({ className = "", force = false }: { className?: string; force?: boolean }) {
  if (!site.showConceptBanner && !force) return null;
  return (
    <span
      className={`ml-[0.4em] inline-block translate-y-[-0.15em] rounded-[3px] border border-current px-[0.35em] py-[0.05em] align-middle font-mono text-[9px] font-normal not-italic uppercase leading-[1.3] tracking-[0.08em] opacity-55 ${className}`}
    >
      sample
    </span>
  );
}
