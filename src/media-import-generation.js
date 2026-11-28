/**
 * Invalidates asynchronous media imports when the active project is replaced.
 * A batch captures one generation so later files cannot spill into a new project.
 */
export function createImportGeneration() {
  let generation = 0;
  return {
    capture: () => generation,
    cancel: () => ++generation,
    isCurrent: token => token === generation
  };
}
