// apps/backend/src/__mocks__/nestjs-passport.ts
// Mock manual para Jest: @nestjs/passport@12 se publica como ESM puro y el
// runtime de Jest (CommonJS) no puede parsear su sintaxis "export". Este mock
// reemplaza el paquete SOLO durante los tests. Los tests de integración
// sustituyen el JwtAuthGuard con overrideGuard, así que aquí basta con que las
// clases existan.
import { CanActivate, DynamicModule } from '@nestjs/common';

// TypeScript exige `any[]` en el constructor para poder extender una clase
// recibida como parámetro (patrón mixin).
type Constructor = new (...args: any[]) => object;

export function AuthGuard(): new () => CanActivate {
  return class MockAuthGuard implements CanActivate {
    canActivate(): boolean {
      return true;
    }
  };
}

export function PassportStrategy(Base: Constructor): Constructor {
  return class MockPassportStrategy extends Base {};
}

export class PassportModule {
  static register(): DynamicModule {
    return { module: PassportModule };
  }
}
