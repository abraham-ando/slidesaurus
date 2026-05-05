# Security Policy

## Supported Versions

Only the latest published version of `slidesaurus` receives security patches.

| Version | Supported          |
| ------- | ------------------ |
| latest  | ✅ Yes             |
| older   | ❌ No              |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by email to:

**<ai.core.net@gmail.com>**

Use the subject line: `[SECURITY] slidesaurus — <brief description>`

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

### Response Timeline

| Step | Target |
|------|--------|
| Acknowledgement | Within 48 hours |
| Status update | Within 7 days |
| Patch for critical issues | Within 14 days |
| Coordinated disclosure | After patch is released |

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

## Disclosure Policy

We follow **coordinated disclosure**:

1. You report privately → we acknowledge within 48 h
2. We develop and test a fix
3. We release the patch as a new version
4. We publicly disclose the vulnerability in the release notes, crediting the reporter (unless anonymity is requested)

Thank you for helping keep Slidesaurus and its users safe.
