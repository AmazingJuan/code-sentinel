// apps/backend/src/__mocks__/nestjs-typeorm.ts
// Mock manual para Jest: @nestjs/typeorm@12 se publica como ESM puro y el runtime
// de Jest (CommonJS) no puede parsear su sintaxis "export". Este mock reemplaza
// el paquete SOLO durante los tests, replicando el único comportamiento que usamos
// en el código real: el decorador @InjectRepository().
import { Inject } from '@nestjs/common';

export function getRepositoryToken(entity: { name: string }): string {
  return `${entity.name}Repository`;
}

export function InjectRepository(entity: { name: string }): ParameterDecorator {
  return Inject(getRepositoryToken(entity));
}