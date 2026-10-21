# Security Policy

## Supported Versions

Security patches are provided for the 1.x line of `slidesaurus`.

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅ Yes    |
| < 1.0   | ❌ No     |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

### Preferred: GitHub Private Vulnerability Reporting

Report the issue privately through GitHub's advisory form:

**<https://github.com/abraham-ando/slidesaurus/security/advisories/new>**

The report stays private between you and the maintainers until a fix is released.

### Alternative: e-mail

If you cannot use GitHub, send an e-mail to:

**<ai.core.net@gmail.com>**

Use the subject line: `[SECURITY] slidesaurus — <brief description>`

### What to include

Whichever channel you use, please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

### Response Timeline

| Step                      | Target                  |
| ------------------------- | ----------------------- |
| Acknowledgement           | Within 48 hours         |
| Status update             | Within 7 days           |
| Patch for critical issues | Within 14 days          |
| Coordinated disclosure    | After patch is released |

## Scope

### In Scope

- **Child process spawning** — argument injection via user-supplied paths, themes, or addon names passed to `slidev build` / `slidev dev`
- **Path traversal** — `presentationId`, `pluginId`, or file paths escaping designated directories
- **Environment variable leakage** — secrets or tokens from the host environment leaking to child processes
- **Package name injection** — malicious package names bypassing validation in `packageResolver`
- **Local path escape** — theme/addon local paths (`./`) resolving outside the project directory

### Out of Scope

- Vulnerabilities in third-party dependencies (Slidev, Docusaurus, Vite) — report those to the respective upstream projects
- Issues requiring physical access to the machine
- Social engineering attacks
- Vulnerabilities in user-authored Slidev presentation content

## Security Hardening

- **Plugin**: no shell for child processes, environment allowlist, `---js` frontmatter refused, opt-in `autoInstall` with `--ignore-scripts`, strict theme/addon name validation. See the [Security documentation page](apps/docs/docs/security.md), including recommended HTTP headers (`frame-ancestors` CSP, `X-Content-Type-Options`, `Referrer-Policy`) and the iframe sandbox policy.
- **Repository**: CodeQL, OpenSSF Scorecard, `pnpm audit` in CI, pnpm `minimumReleaseAge` / `strictDepBuilds`, Actions pinned by SHA, Renovate updates.
- **Releases**: published from GitHub Actions with npm provenance (trusted publishing) through a protected `npm` environment.

## Disclosure Policy

We follow **coordinated disclosure**:

1. You report privately → we acknowledge within 48 h
2. We develop and test a fix
3. We release the patch as a new version
4. We publicly disclose the vulnerability in the release notes, crediting the reporter (unless anonymity is requested)

Thank you for helping keep Slidesaurus and its users safe.
