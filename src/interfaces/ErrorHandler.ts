export type ErrorHandler = (name: string) => void;
export const ignoring: ErrorHandler = () => void 0;