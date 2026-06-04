export function FormFieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <small className="fieldError">{message}</small>;
}
