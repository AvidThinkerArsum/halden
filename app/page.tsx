import { Hero } from "@/components/hero/Hero";
import { CallBar, ConceptBanner, Nav } from "@/components/Nav";
import { Sheets } from "@/components/Sheets";
import { Layers } from "@/components/Layers";
import { Costs } from "@/components/Costs";
import { Seasons } from "@/components/Seasons";
import { Work } from "@/components/Work";
import { Reserve } from "@/components/Reserve";
import { Close } from "@/components/Close";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <ConceptBanner />
      <Nav />
      <main>
        <Hero />
        <Sheets />
        <Layers />
        <Costs />
        <Seasons />
        <Work />
        <Reserve />
        <Close />
      </main>
      <Footer />
      <CallBar />
    </>
  );
}
