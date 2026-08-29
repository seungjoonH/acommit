# API backend setup protocol

Use this exact protocol for `init`, `config`, and a commit that discovers incomplete API setup. Do not ask for an API key in chat and never print a secret value.

1. Run `api-setup-status`.
2. If configured, ask: reuse existing settings, reconfigure, or cancel.
3. If partial, ask: complete missing values, reset and reconfigure, or cancel.
4. Select exactly one provider: `gemini`, `openai`, or `openrouter`.
5. Explain the preferred variable from status. Recommend `~/.acommit/.env` with directory mode `700` and file mode `600`; project `.env` is allowed only when ignored by Git.
6. Re-run status. Reveal only configured/source/variable/missing.
7. Run `models-list`. If discovery fails, offer manual model ID entry or cancel; never invent a model.
8. Explain that a connection test can incur API usage and run `api-test` only with explicit consent.
9. Show backend, provider, model, key source, execution settings, and confirm.
10. Run `api-setup-save` only after all required values validate and final confirmation is received.

Environment precedence is process, project `.env`, then `~/.acommit/.env`; within each source, `ACOMMIT_*` wins. A failure never changes the prior backend and never falls back automatically. Offer only retry, one-time Agent, reconfigure API, or cancel.
