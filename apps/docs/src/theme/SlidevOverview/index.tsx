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
 * overview page. This wrapper renders the banner then delegates everything
 * else to the original component.  The original includes its own `<Layout>`
 * wrapper, so we must NOT add a second `<Layout>` here.
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
    <>
      {/*
       * The banner sits outside SlidevOverview's <Layout> wrapper.
       * It renders server-side safely (no window access) and is visible
       * on both the root overview and every category sub-page.
       *
       * If you only want the banner on the root page, gate it with:
       *   const location = useLocation();
       *   const isRoot = location.pathname === config.routeBasePath;
       */}
      <div className={styles.teamBanner} role="banner" aria-label="Team learning hub">
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
      </div>

      {/* Original overview — search bar, sidebar, cards, everything. */}
      <OriginalSlidevOverview {...props} />
    </>
  );
}
