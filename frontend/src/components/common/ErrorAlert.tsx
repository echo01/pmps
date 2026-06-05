import { ApiClientError } from '../../api/apiResponse';

export function ErrorAlert({ error, title = 'Unable to load data' }: { error: unknown; title?: string }) {
  const apiError = error instanceof ApiClientError ? error : null;
  const message = error instanceof Error ? error.message : 'Unknown error';

  return (
    <div className="alert error">
      <strong>{title}</strong>
      <span>{message}</span>
      {apiError?.errors.length ? (
        <ul>
          {apiError.errors.map((item) => (
            <li key={`${item.field || 'error'}-${item.message}`}>
              {item.field ? `${item.field}: ` : ''}
              {item.message}
            </li>
          ))}
        </ul>
      ) : null}
      {apiError?.requestId ? <small>Request ID: {apiError.requestId}</small> : null}
    </div>
  );
}
