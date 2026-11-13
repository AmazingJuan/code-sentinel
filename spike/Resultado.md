# Resultados — Spike SAST y secretos

Fecha: 2026-11-05 · Rama: `spike/sast-secretos`
Herramientas: Semgrep CE (Docker `semgrep/semgrep`), Gitleaks (Docker `ghcr.io/gitleaks/gitleaks:latest`)

## Criterios de éxito

- [x] Gitleaks detecta el token falso y lo enmascara (`RuleID: github-pat`, `Secret: REDACTED`)
- [x] Semgrep detecta `eval()` en `.ts` (`no-eval`, ERROR) y `v-html` en `.vue` (`no-v-html`, WARNING)
- [x] Ambas corren con `--network none`; Semgrep confirma que no envía métricas
- [x] Los campos del JSON coinciden con el mapeo a `Finding`
- [x] Códigos de salida: Gitleaks `1` con hallazgos, `0` sin hallazgos; Semgrep `0` con o sin hallazgos

## Escaneo del código real

- Gitleaks sobre `apps`: 1 falso positivo (`token=abc123def456` en `apps/backend/README.md`, plantilla de NestJS). Resuelto con allowlist en `.gitleaks.toml` (`regexTarget = "match"`).
- Semgrep sobre `apps/backend/src` y `apps/frontend/src`: _[completar: N hallazgos]_

## Hallazgos para el diseño del CLI

1. Semgrep solo escanea archivos registrados en git; fuera de un repo hay que usar `--no-git-ignore`.
2. Montar el repo completo desde Windows deja a Semgrep bloqueado; montar solo las carpetas a escanear.
3. En Git Bash, los comandos `docker run` necesitan `MSYS_NO_PATHCONV=1`.
4. Gitleaks sale con `1` cuando encuentra secretos: el CLI no debe marcarlo como scan `failed`.
5. Nunca guardar `Secret` ni `Match`; usar siempre `--redact`.
6. Se necesita una forma de marcar falsos positivos (allowlist).
7. Gitleaks no asigna severidad: definir una regla documentada (RF-022).

## Decisión

Semgrep + Gitleaks aprobadas para la Fase 1.