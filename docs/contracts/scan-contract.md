# Contrato de ingesta CLI → Backend

Todas las llamadas requieren `Authorization: Bearer <JWT>` de un usuario **analyst**.
El admin recibe 403 (RF-032). Un proyecto no asignado al analista recibe 403 (RF-035).
El backend rechaza con 400 cualquier campo que no esté en este contrato (whitelist).

## Flujo

1. `POST /auth/login` → token.
2. `POST /scans` `{ projectId, tools[] }` → 201, scan en `pending`.
3. El CLI valida la ruta del proyecto.
   - Válida → `PATCH /scans/:id/status` `{ status: "running" }`.
   - Inválida → `PATCH /scans/:id/status` `{ status: "failed", errorMessage }` y termina.
4. Ejecuta las herramientas en local (NFR-007).
5. `POST /scans/:id/results` `{ status, errorMessage?, findings[] }` → 200 con conteos.

## Transiciones (si no, 409)

| Desde | Hacia |
| --- | --- |
| pending | running, failed |
| running | completed, failed |
| completed / failed | (ninguna) |

## Campos de un finding

| Campo | Tipo | Regla |
| --- | --- | --- |
| type | string | obligatorio, no vacío |
| severity | critical / high / medium / low / null | minúsculas |
| toolCategory | SAST / Secret Scanner / Port Scanner | obligatorio |
| sourceTool | string | nombre real: Semgrep, Gitleaks, CodeSentinel |
| filePath | string / null | relativo a la raíz del proyecto |
| line | entero ≥ 1 / null | |
| description | string / null | |
| recommendation | string / null | |

## Reglas de cierre

- `status: "failed"` exige `errorMessage` no vacío y `findings: []`.
- Los conteos (`criticalCount`, …, `totalCount`) los calcula el backend; el CLI no los envía.
- Nunca se envían `Secret` ni `Match` de Gitleaks: el backend responde 400.