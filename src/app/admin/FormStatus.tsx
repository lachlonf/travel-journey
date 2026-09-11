export function FormStatus({ error, message }: { error?: string | null; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="form-error">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="form-ok">
        {message}
      </p>
    );
  }
  return null;
}
