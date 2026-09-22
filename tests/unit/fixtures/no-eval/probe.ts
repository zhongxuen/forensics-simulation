// Fixture for tests/unit/no-eval.test.ts: one of each thing the guard must flag. Never imported.
export function probe(text: string, element: HTMLElement) {
  eval(text);
  const made = new Function(text);
  const again = Function(text);
  setTimeout("console.log(1)", 10);
  element.innerHTML = text;
  element.insertAdjacentHTML("beforeend", text);
  document.write(text);
  return [made, again];
}
