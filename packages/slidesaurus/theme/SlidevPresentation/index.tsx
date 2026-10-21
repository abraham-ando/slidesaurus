import React, { useState, useEffect, useRef, useMemo } from "react";
import Layout from "@theme/Layout";
import Head from "@docusaurus/Head";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { usePluginData } from "@docusaurus/useGlobalData";
import { useLocation } from "@docusaurus/router";
import type { PluginData, Presentation, PlaylistData } from "../types";
import type { PresentationBuildStatus } from "../../src/domain/types";
import { PLUGIN_NAME } from "../types";
import SlidevIframe from "../SlidevIframe";
import { PlaylistIcon, DownloadIcon } from "../icons";
import { useBuildStatus } from "./useBuildStatus";

function exportLabel(url: string): string {
  const ext = url.split(".").pop()?.toUpperCase() ?? "FILE";
  return ["PDF", "PPTX"].includes(ext) ? ext : "FILE";
}
import styles from "./styles.module.css";

/** Resolves a site-relative URL (already including baseUrl) against `siteConfig.url`. */
function toAbsoluteUrl(siteUrl: string, path: string): string {
  try {
    return new URL(path, siteUrl).href;
  } catch {
    return path;
  }
}

/**
 * Reads the current slide number from the Slidev iframe.
 * Supports both Slidev router modes: `history` (default, `<url>/N`) and
 * `hash` (`#/N`, with `#N` accepted for legacy values).
 * Returns null when the iframe is cross-origin or no slide is routed yet.
 */
function readSlide(
  win: Window | null | undefined,
  baseUrl: string,
): number | null {
  try {
    if (!win) return null;
    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const { pathname, hash } = win.location;
    if (pathname.startsWith(base)) {
      const m = /^(\d+)\/?$/.exec(pathname.slice(base.length));
      if (m) return parseInt(m[1], 10);
    }
    const hm = /^#\/?(\d+)/.exec(hash);
    return hm ? parseInt(hm[1], 10) : null;
  } catch {
    return null;
  }
}

/** Navigates the Slidev iframe to a slide, whichever router mode it uses. */
function goToSlide(win: Window, baseUrl: string, slide: number): void {
  try {
    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    if (
      win.location.pathname.startsWith(base) &&
      /^\d+\/?$/.test(win.location.pathname.slice(base.length))
    ) {
      // history mode: update the URL then let vue-router pick it up
      win.history.replaceState(win.history.state, "", `${base}${slide}`);
      win.dispatchEvent(
        new PopStateEvent("popstate", { state: win.history.state }),
      );
    } else {
      // hash mode
      win.location.hash = `#/${slide}`;
    }
  } catch {
    // cross-origin: nothing we can do
  }
}

function buildJsonLd(p: Presentation): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: p.title,
  };
  if (p.description) ld.description = p.description;
  if (p.author) ld.author = { "@type": "Person", name: p.author };
  if (p.level) ld.educationalLevel = p.level;
  if (p.duration) ld.timeRequired = `PT${p.duration}M`;
  if (p.lastReviewed) ld.dateModified = p.lastReviewed;
  if (p.tags?.length) ld.keywords = p.tags.join(", ");
  return ld;
}

function PresentationHead({
  p,
  url,
  imageUrl,
}: {
  p: Presentation;
  url: string;
  imageUrl?: string;
}) {
  return (
    <Head>
      <meta property="og:type" content="article" />
      <meta property="og:title" content={p.title} />
      {p.description && (
        <meta property="og:description" content={p.description} />
      )}
      <meta property="og:url" content={url} />
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      <meta
        name="twitter:card"
        content={imageUrl ? "summary_large_image" : "summary"}
      />
      <meta name="twitter:title" content={p.title} />
      {p.description && (
        <meta name="twitter:description" content={p.description} />
      )}
      {imageUrl && <meta name="twitter:image" content={imageUrl} />}
      <script type="application/ld+json">
        {JSON.stringify(buildJsonLd(p))}
      </script>
    </Head>
  );
}

/**
 * `docusaurus start` only: shown instead of the iframe while the presentation
 * has no output yet (first build queued / running) or its build failed.
 */
function DevBuildState({
  presentation,
  status,
}: {
  presentation: Presentation;
  status: PresentationBuildStatus | null;
}) {
  const failed = status?.state === "failed";
  return (
    <div className={styles.devLauncherContainer}>
      <div className={styles.devLauncherCard}>
        {presentation.category && (
          <div className={styles.devLauncherCategory}>
            {presentation.category}
          </div>
        )}
        <div className={styles.devLauncherTitle}>{presentation.title}</div>
        <div
          className={styles.devLauncherStatus}
          role="status"
          aria-live="polite"
        >
          {failed ? (
            <>
              <svg
                className={styles.devErrorIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" d="M12 7v6m0 4h.01" />
              </svg>
              <p className={styles.devLauncherStatusText}>
                This presentation failed to build.
              </p>
              {status?.error && (
                <code className={styles.devElapsed}>{status.error}</code>
              )}
              <p className={styles.devLauncherHint}>
                See the terminal for details — it is rebuilt when you save the
                file.
              </p>
            </>
          ) : (
            <>
              <div className={styles.devSpinner} aria-hidden="true" />
              <p className={styles.devLauncherStatusText}>
                {status?.state === "building"
                  ? "Building this presentation…"
                  : "Waiting for the Slidev build…"}
              </p>
              <p className={styles.devLauncherHint}>
                It opens automatically when the build is ready.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SlidevPresentation({
  pluginId = "default",
}: {
  readonly pluginId?: string;
}) {
  const { presentations, playlists, config, buildStatusUrl } = usePluginData(
    PLUGIN_NAME,
    pluginId,
  ) as PluginData;
  const uiTheme = config?.uiTheme ?? "default";
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [resumeSlide, setResumeSlide] = useState<number | null>(null);
  const { siteConfig } = useDocusaurusContext();
  // Slide to apply once the iframe has loaded (set when the user clicks "Resume")
  const pendingSlideRef = useRef<number | null>(null);
  const [showResumeBar, setShowResumeBar] = useState(false);

  const presentation = presentations.find((p) => {
    const normalizedUrl = p.url.replace(/\/$/, "");
    const normalizedPath = location.pathname.replace(/\/$/, "");
    return normalizedUrl === normalizedPath;
  });

  // Find the first playlist this presentation belongs to, and its prev/next neighbours.
  const playlistNav = useMemo((): {
    playlist: PlaylistData;
    prev: Presentation | null;
    next: Presentation | null;
    index: number;
  } | null => {
    if (!presentation) return null;
    const playlist = playlists.find((pl) => pl.items.includes(presentation.id));
    if (!playlist) return null;
    const index = playlist.items.indexOf(presentation.id);
    const prevId = index > 0 ? playlist.items[index - 1] : null;
    const nextId =
      index < playlist.items.length - 1 ? playlist.items[index + 1] : null;
    return {
      playlist,
      prev: prevId
        ? (presentations.find((p) => p.id === prevId) ?? null)
        : null,
      next: nextId
        ? (presentations.find((p) => p.id === nextId) ?? null)
        : null,
      index,
    };
  }, [presentation?.id, playlists, presentations]);

  // `docusaurus start` builds in the background: follow the build status
  // (undefined in production, where the output always exists).
  const buildStatus = useBuildStatus(buildStatusUrl, presentation?.id);
  const builtAt = buildStatus?.builtAt;
  const lastBuiltAtRef = useRef<number | undefined>(undefined);
  const [iframeKey, setIframeKey] = useState<number | undefined>(undefined);
  // A rebuild changes `builtAt`: the iframe is remounted (key) and brought
  // back to the slide it was showing.
  useEffect(() => {
    if (builtAt === undefined) return;
    if (
      lastBuiltAtRef.current !== undefined &&
      lastBuiltAtRef.current !== builtAt &&
      presentation
    ) {
      const slide = readSlide(
        iframeRef.current?.contentWindow,
        presentation.url,
      );
      if (slide !== null && slide > 1) pendingSlideRef.current = slide;
      setIframeKey(builtAt);
    }
    lastBuiltAtRef.current = builtAt;
  }, [builtAt]);

  // Dev mode serves the same static build output as production, so the
  // iframe always loads `presentation.url`; only the resume offer is computed here.
  useEffect(() => {
    if (!presentation) return;

    try {
      const stored = localStorage.getItem(`slidev-resume-${presentation.id}`);
      const slide = stored ? parseInt(stored, 10) : NaN;
      if (!isNaN(slide) && slide > 1) {
        setResumeSlide(slide);
        setShowResumeBar(true);
      }
    } catch {
      // storage unavailable
    }
  }, [presentation?.id]);

  // Persist the current slide when leaving: on page unload AND on in-app
  // (SPA) navigation, which does not fire `beforeunload`.
  useEffect(() => {
    if (!presentation) return;
    const storageKey = `slidev-resume-${presentation.id}`;
    const url = presentation.url;

    const save = () => {
      const slide = readSlide(iframeRef.current?.contentWindow, url);
      if (slide !== null && slide > 1) {
        try {
          localStorage.setItem(storageKey, String(slide));
        } catch {
          // storage unavailable
        }
      }
    };

    window.addEventListener("beforeunload", save);
    return () => {
      window.removeEventListener("beforeunload", save);
      save();
    };
  }, [presentation?.id]);

  if (!presentation) {
    return (
      <Layout title="Presentation Not Found">
        <div className={styles.container}>
          <div className={styles.errorState}>
            <svg
              className={styles.errorIcon}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 4h1m4 0h13M4 4v10a2 2 0 0 0 2 2h10m3.42-.592c.359-.362.58-.859.58-1.408V4m-8 12v4m-3 0h6m-7-8l2-2m4 0l2-2M3 3l18 18"
              />
            </svg>
            <h1 className={styles.errorTitle}>Presentation Not Found</h1>
            <p className={styles.errorText}>
              The presentation at <code>{location.pathname}</code> could not be
              found.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const handleResume = () => {
    pendingSlideRef.current = resumeSlide;
    setShowResumeBar(false);
    applyPendingSlide();
  };

  // Applies the requested slide once Slidev's router has settled on its first slide.
  const applyPendingSlide = () => {
    const win = iframeRef.current?.contentWindow;
    const slide = pendingSlideRef.current;
    if (!win || slide === null) return;
    let attempts = 0;
    const tryApply = () => {
      if (pendingSlideRef.current === null) return;
      if (
        readSlide(iframeRef.current?.contentWindow, presentation.url) !==
          null ||
        attempts >= 50
      ) {
        pendingSlideRef.current = null;
        goToSlide(win, presentation.url, slide);
        return;
      }
      attempts += 1;
      setTimeout(tryApply, 100);
    };
    tryApply();
  };

  const handleDismiss = () => {
    localStorage.removeItem(`slidev-resume-${presentation.id}`);
    setShowResumeBar(false);
  };

  const resumeBar = showResumeBar && resumeSlide !== null && (
    <div className={styles.resumeBar} role="status">
      <span>You left off at slide {resumeSlide}</span>
      <div className={styles.resumeActions}>
        <button
          className={styles.resumeBtn}
          onClick={handleResume}
          type="button"
        >
          Resume from slide {resumeSlide}
        </button>
        <button
          className={styles.resumeBtnSecondary}
          onClick={handleDismiss}
          type="button"
        >
          Start from beginning
        </button>
      </div>
    </div>
  );

  const playlistBar = playlistNav && (
    <div className={styles.playlistBar}>
      <div className={styles.playlistInfo}>
        <PlaylistIcon width={13} height={13} />
        <span className={styles.playlistTitle}>
          {playlistNav.playlist.title}
        </span>
        <span className={styles.playlistProgress}>
          {playlistNav.index + 1} / {playlistNav.playlist.items.length}
        </span>
      </div>
      <div className={styles.playlistActions}>
        {playlistNav.prev ? (
          <Link
            to={playlistNav.prev.url}
            className={styles.playlistNavBtn}
            aria-label={`Previous in playlist: ${playlistNav.prev.title}`}
          >
            ← {playlistNav.prev.title}
          </Link>
        ) : (
          <span className={styles.playlistNavBtnDisabled}>← First</span>
        )}
        {playlistNav.next ? (
          <Link
            to={playlistNav.next.url}
            className={styles.playlistNavBtn}
            aria-label={`Next in playlist: ${playlistNav.next.title}`}
          >
            {playlistNav.next.title} →
          </Link>
        ) : (
          <span className={styles.playlistNavBtnDisabled}>Last →</span>
        )}
      </div>
    </div>
  );

  const devBuildState =
    buildStatus === undefined ? null : (
      <DevBuildState presentation={presentation} status={buildStatus} />
    );
  // `pending` (queued, maybe a cache hit) keeps the current build without a banner.
  const rebuildBanner = buildStatus?.hasOutput &&
    (buildStatus.state === "building" || buildStatus.state === "failed") && (
      <div className={styles.resumeBar} role="status">
        <span>
          {buildStatus.state === "failed"
            ? `Last rebuild failed — showing the previous build. ${buildStatus.error ?? ""}`
            : "Rebuilding this presentation… it will reload when ready."}
        </span>
      </div>
    );

  return (
    <Layout title={presentation.title} description={presentation.description}>
      <PresentationHead
        p={presentation}
        url={toAbsoluteUrl(siteConfig.url, presentation.url)}
        imageUrl={
          presentation.thumbnailUrl
            ? toAbsoluteUrl(siteConfig.url, presentation.thumbnailUrl)
            : undefined
        }
      />
      <div
        className={styles.presentationContainer}
        data-slidev-ui-theme={uiTheme}
      >
        {uiTheme !== "minimal" && (
          <div className={styles.presenterLinkBar}>
            {presentation.exportUrls?.map((exportUrl) => (
              <a
                key={exportUrl}
                href={exportUrl}
                download
                className={styles.downloadLink}
                aria-label={`Download ${exportLabel(exportUrl)}`}
              >
                <DownloadIcon width={13} height={13} />
                {exportLabel(exportUrl)}
              </a>
            ))}
            <a
              href={`${presentation.url}presenter/`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.presenterLink}
            >
              Presenter View
            </a>
          </div>
        )}
        {rebuildBanner}
        {resumeBar}
        {uiTheme !== "minimal" && playlistBar}
        {buildStatus === undefined || buildStatus?.hasOutput ? (
          <SlidevIframe
            key={iframeKey ?? "output"}
            ref={iframeRef}
            src={presentation.url}
            className={styles.presentationIframe}
            title={presentation.title}
            allowFullScreen
            onLoad={applyPendingSlide}
          />
        ) : (
          devBuildState
        )}
      </div>
    </Layout>
  );
}
