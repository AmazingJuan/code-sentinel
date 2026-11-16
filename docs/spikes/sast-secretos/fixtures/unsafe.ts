export function runUserCode(userInput: string): unknown {
  return eval(userInput)
}