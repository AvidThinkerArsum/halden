import { site } from "@/lib/site";
import { Sample } from "@/components/ui/Sample";

export function Footer() {
  const credits = [
    { what: "Hero garden", ...site.photos.hero },
    ...site.projects.map((p) => ({ what: p.title, id: p.id, credit: p.credit, title: p.title })),
  ];
  return (
    <footer data-nav="dark" className="bg-dusk-2 pb-28 text-vellum/70 md:pb-10">
      <div className="mx-auto max-w-[1500px] px-5 pt-16 sm:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-10 border-b border-vellum/10 pb-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="display text-[2.2rem] text-vellum [overflow-wrap:anywhere]">{site.name}</p>
            <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.16em]">{site.descriptor} · {site.town}, {site.state}</p>
            <p className="mt-6 text-[14px] leading-relaxed">
              <a href={site.phoneHref} className="font-mono text-vellum hover:text-warm">{site.phone}</a>
              <br />
              <a href={`mailto:${site.email}`} className="hover:text-warm">{site.email}</a>
            </p>
          </div>
          <div className="md:col-span-5">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-vellum/45">Where we work</p>
            <p className="mt-3 text-[14.5px] leading-relaxed text-vellum/80">{site.serviceTowns.join(" · ")}</p>
          </div>
          <div className="md:col-span-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-vellum/45">Credentials</p>
            <p className="mt-3 text-[14px] leading-relaxed">
              {site.credentials}
              <Sample className="text-vellum" />
              <br />
              WA Contractor Reg. # {site.contractorReg || <span className="font-mono text-vellum/40">——————</span>}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 py-8 text-[12.5px] leading-relaxed md:grid-cols-12">
          <p className="md:col-span-5">
            {site.fictional
              ? `${site.name} is a fictional business. Every figure, review, availability state and credential on this page is sample content, made for a design concept.`
              : site.showConceptBanner
                ? `Unofficial concept for ${site.name}, not affiliated. Figures, reviews, availability and credentials shown are samples.`
                : null}
          </p>
          <p className="md:col-span-7">
            Photos from Pexels:{" "}
            {credits.map((c, i) => (
              <span key={c.id}>
                <a className="underline decoration-vellum/30 underline-offset-2 hover:text-vellum" href={`https://www.pexels.com/photo/${c.id}/`} target="_blank" rel="noopener noreferrer">
                  {c.what}
                </a>{" "}
                by {c.credit}
                {i < credits.length - 1 ? " · " : "."}
              </span>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
