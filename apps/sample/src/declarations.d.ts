/**
 * Type declaration for the `@theme/SlidevLink` alias, which Docusaurus resolves
 * through webpack at build time. Must stay a global *script* (no top-level
 * `import`/`export`) so it declares the module instead of augmenting it.
 */
declare module "@theme/SlidevLink" {
  import type { FC } from "react";

  const SlidevLink: FC<{
    /** Presentation URL path, without the site's baseUrl. */
    link: string;
    /** CSS width of the preview card (default "550px"). */
    width?: string;
    pluginId?: string;
  }>;
  export default SlidevLink;
}
