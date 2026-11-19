// Jest stub: @nestjs/passport@12 ships as pure ESM, which the CommonJS Jest
// runtime cannot parse. Integration tests replace JwtAuthGuard through
// overrideGuard, so these classes only need to exist.
import { CanActivate, DynamicModule } from '@nestjs/common';

// TypeScript requires an `any[]` constructor signature for a class received as
// a parameter to be extendable (mixin pattern).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor = new (...args: any[]) => object;

export function AuthGuard(): new () => CanActivate {
  return class MockAuthGuard implements CanActivate {
    canActivate(): boolean {
      return true;
    }
  };
}

export function PassportStrategy(Base: Constructor): Constructor {
  return class MockPassportStrategy extends Base {
    constructor(...args: unknown[]) {
      super(...args, () => undefined);
    }
  };
}

export class PassportModule {
  static register(): DynamicModule {
    return { module: PassportModule };
  }
}
