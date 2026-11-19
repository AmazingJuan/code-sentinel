const RULE = '----------------------------------------------------';

export function printBanner(title: string): void {
  console.log(RULE);
  console.log(` Code Sentinel - ${title}`);
  console.log(RULE);
}

export function printRule(): void {
  console.log(RULE);
}
