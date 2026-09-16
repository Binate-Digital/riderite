import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { Services } from "@/components/site/Services";
import { HowItWorks } from "@/components/site/HowItWorks";
import { DriveWithUs } from "@/components/site/DriveWithUs";
import { Cities } from "@/components/site/Cities";
import { CTA } from "@/components/site/CTA";
import { Footer } from "@/components/site/Footer";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "RideRite — Florida Rideshare for Sedans, SUVs & Trucks" },
      { name: "description", content: "Book sedans, SUVs and trucks across Florida in one tap. RideRite is the bold new rideshare — ride with confidence or drive with us and earn on your terms." },
      { property: "og:title", content: "RideRite — Florida Rideshare for Sedans, SUVs & Trucks" },
      { property: "og:description", content: "Florida's bold new rideshare. Book sedans, SUVs and trucks in one tap, or drive with us and earn on your terms." },
      { property: "og:url", content: "https://getriderite.com/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://getriderite.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "RideRite",
              url: "https://getriderite.com/",
              logo: "https://getriderite.com/favicon.ico",
              sameAs: [],
            },
            {
              "@type": "WebSite",
              name: "RideRite",
              url: "https://getriderite.com/",
            },
            {
              "@type": "TaxiService",
              name: "RideRite",
              url: "https://getriderite.com/",
              description: "On-demand sedan, SUV and truck rideshare across Florida.",
              areaServed: { "@type": "State", name: "Florida" },
              provider: { "@type": "Organization", name: "RideRite" },
            },
          ],
        }),
      },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <Services />
        <HowItWorks />
        <DriveWithUs />
        <Cities />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
