export class RichTextValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RichTextValidationError';
  }
}