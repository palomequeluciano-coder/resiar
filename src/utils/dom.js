export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function qsa(selector, scope = document) {
  return [...scope.querySelectorAll(selector)];
}

export function setText(element, value) {
  if (!element) return;
  element.textContent = value ?? '';
}
