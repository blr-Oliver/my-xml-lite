export interface ErrorTracker {
  error(name: string): void;
}

export const ignoring: ErrorTracker = {
  error(name: string) {
  }
}