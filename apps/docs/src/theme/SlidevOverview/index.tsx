/**
 * Swizzle wrapper — SlidevOverview
 * ─────────────────────────────────────────────────────────────────────────────
 * Injects a "Team Learning Hub" banner above the standard presentation
 * overview. The banner displays team branding, a short tagline, and a
 * call-to-action link — without modifying the overview's search, filters,
 * or presentation grid.
 *
 * ── How it works ────────────────────────────────────────────────────────────
 * `@theme-original/SlidevOverview` resolves to the plugin's built-in
 * overview page. The original renders its own `<Layout>`, so we must NOT add a
 * second one here. Instead the banner is passed as `children`, which the
 * original renders inside its `<Layout>` (below the navbar), above the overview.
 *
 * ── Customising ─────────────────────────────────────────────────────────────
 * • Edit the `TEAM_BANNER` constant to change text/links.
 * • Replace `teamAvatar` with an `<img>` to use your team logo.
 * • Wrap with `<BrowserOnly>` if the banner needs browser-only data
 *   (localStorage, user session, …).
 * • Remove the banner entirely and add other injections (footer note,
 *   announcement bar, etc.) using the same pattern.
 */
import Link from "@docusaurus/Link";
import OriginalSlidevOverview from "@theme-original/SlidevOverview";
import styles from "./styles.module.css";

// ── Banner configuration — edit here ─────────────────────────────────────────

const TEAM_BANNER = {
  /** Emoji or short text displayed inside the circular avatar area. */
  avatar: "🦕",
  /** Team or organisation name. */
  name: "Engineering Learning Hub",
  /** Short tagline displayed below the name. */
  tagline: "Curated Slidev presentations from the engineering team — learn, share, grow.",
  /** Label and URL for the call-to-action button. */
  cta: {
    label: "Contribute a presentation →",
    href: "https://github.com/abraham-ando/slidesaurus",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────

type Props = React.ComponentProps<typeof OriginalSlidevOverview>;

export default function SlidevOverview(props: Props) {
  return (
    // Original overview — search bar, sidebar, cards, everything.
    // The banner is rendered inside its <Layout>, so it sits under the navbar and
    // is visible on the root overview and every category sub-page.
    // To show it only on the root page, gate it with `useLocation()` here.
    <OriginalSlidevOverview {...props}>
      <section className={styles.teamBanner} aria-label="Team learning hub">
        <div className={styles.teamAvatar} aria-hidden="true">
          {TEAM_BANNER.avatar}
        </div>
        <div className={styles.teamText}>
          <p className={styles.teamName}>{TEAM_BANNER.name}</p>
          <p className={styles.teamTagline}>{TEAM_BANNER.tagline}</p>
        </div>
        <Link to={TEAM_BANNER.cta.href} className={styles.teamCta}>
          {TEAM_BANNER.cta.label}
        </Link>
      </section>
    </OriginalSlidevOverview>
  );
}
