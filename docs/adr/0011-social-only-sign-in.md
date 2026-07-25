# Social-only sign-in

Authentication is GitHub and Google federated through Cognito. There are no
passwords, no email/password form, and no email verification or reset flows.

**This deviates from the mockups**, which show a sign-in card with two prefixed
`Input` fields. The replacement is simpler — two buttons, `> AUTHENTICATE VIA
GITHUB` — and reads correctly in the terminal aesthetic.

The trigger was email delivery. Cognito's built-in sender is capped at 50 messages
per day from a generic Amazon address, and moving to SES means requesting
production access out of a sandbox that only permits verified recipients — a
manual review with a day or two of lead time, blocking signup for anyone but the
developer. Rather than solve that, we removed the need for it: a federated
identity provider has already verified the address, so no message is ever sent.

What this deletes: SES entirely, the sandbox review, deliverability and spam-
folder concerns, the password reset flow, credential storage, and every decision
about hashing. The remaining audience cost is negligible — this is a product for
developers, and GitHub sign-in is one click for effectively all of them.

## Consequences

Anyone unwilling to federate cannot register, and can only play as an Unclaimed
User (ADR-0007) — which, since Unclaimed Users have full Leaderboard placement,
costs them only persistence and a chosen Handle.
