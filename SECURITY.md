# Security Policy

## Supported versions

AmbyKit follows semantic versioning. Security fixes land on the latest minor release.

| Version | Supported |
| ------- | --------- |
| 1.1.x   | ✅        |
| < 1.1   | ❌        |

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through
[GitHub Security Advisories](https://github.com/ambystechcom/AmbyKit/security/advisories/new), or by
email to **security@ambystech.com**.

Please include:

- the version of AmbyKit (`ambykit --version`) and your Node version,
- what an attacker could do with it,
- steps to reproduce, ideally a minimal project.

You can expect an acknowledgement within 5 business days and an assessment within 10. If the report
is confirmed, we will agree a disclosure timeline with you and credit you in the advisory unless you
prefer otherwise.

## Scope

AmbyKit is a CLI that reads and writes files in your project and installs prompt/rules files for AI
coding assistants. Things we consider in scope:

- path traversal or writes outside the project directory,
- code execution triggered by parsing a template, spec, or config file,
- supply-chain issues in the published npm package (`@ambystech/ambykit`).

Out of scope: the behaviour of the AI assistants themselves, and prompt-injection content that a
user deliberately places in their own spec files.
