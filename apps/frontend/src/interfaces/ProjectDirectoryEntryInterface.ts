// apps/frontend/src/interfaces/ProjectDirectoryEntryInterface.ts
/**
 * Minimal view of a project that the administrator receives (RF-032 + RF-035):
 * only what is needed to assign it to users, never its security content.
 */
export interface ProjectDirectoryEntryInterface {
  id: string
  name: string
}