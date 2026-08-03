# Regras Firebase

Princípios implementados:

- autenticação obrigatória;
- isolamento por UID;
- custom claim para administração;
- autoelevação negada;
- catálogo global somente por admin;
- Storage privado por UID, JPEG e até 3 MB;
- negação padrão.

Execute `pnpm test:emulator:rules`. A suíte cobre permitido/negado, anônimo, acesso cruzado, admin e upload malicioso. Mudanças nas Rules não podem ser publicadas sem esse teste e revisão do diff.
