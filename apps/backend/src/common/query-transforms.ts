import { Transform, TransformFnParams } from 'class-transformer';

/**
 * Treats empty query-string values (`?type=`) as absent so optional filters
 * cleared in the UI do not fail validation.
 */
export function EmptyStringToUndefined(): PropertyDecorator {
  return Transform(({ value }: TransformFnParams): unknown =>
    value === '' ? undefined : value,
  );
}
