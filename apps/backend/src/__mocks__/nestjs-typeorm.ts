// Jest stub: @nestjs/typeorm@12 ships as pure ESM, which the CommonJS Jest
// runtime cannot parse. It replaces the package only in tests and reproduces
// the one behavior the code under test relies on: @InjectRepository().
import { Inject } from '@nestjs/common';

export function getRepositoryToken(entity: { name: string }): string {
  return `${entity.name}Repository`;
}

export function InjectRepository(entity: { name: string }): ParameterDecorator {
  return Inject(getRepositoryToken(entity));
}
