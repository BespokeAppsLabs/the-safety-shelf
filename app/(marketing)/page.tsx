import { LandingScreen } from "@/components/landing/LandingScreen";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

// Site-level structured data. Lives on the landing page only — repeating the
// Organization node on every route adds nothing and risks conflicting copies.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      logo: `${SITE_URL}/images/og.jpg`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingScreen />
    </>
  );
}
