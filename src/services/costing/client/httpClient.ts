export interface HttpClientOptions {
  baseUrl: string;
  getHeaders?: () => Record<string, string>;
}

export interface HttpClient {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  delete<T>(path: string, init?: RequestInit): Promise<T>;
}

const buildUrl = (baseUrl: string, path: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

const mergeInit = (init: RequestInit | undefined, headers: Record<string, string>): RequestInit => {
  const mergedHeaders = { ...(init?.headers as Record<string, string> | undefined), ...headers };
  return { ...init, headers: mergedHeaders };
};

const send = async <T>(baseUrl: string, method: string, path: string, init: RequestInit): Promise<T> => {
  const response = await fetch(buildUrl(baseUrl, path), { ...init, method });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Costing API error ${response.status}: ${errorBody}`);
  }
  if (response.status === 204) {
    return undefined as unknown as T;
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.blob()) as unknown as T;
};

export const createHttpClient = ({ baseUrl, getHeaders }: HttpClientOptions): HttpClient => {
  const resolveHeaders = () => ({ 'Content-Type': 'application/json', ...(getHeaders?.() ?? {}) });

  return {
    get: (path, init) => {
      const headers = resolveHeaders();
      return send(baseUrl, 'GET', path, mergeInit(init, headers));
    },
    post: (path, body, init) => {
      const headers = resolveHeaders();
      const requestInit: RequestInit = mergeInit(init, headers);
      if (body !== undefined) {
        requestInit.body = headers['Content-Type'] === 'application/json' ? JSON.stringify(body) : (body as BodyInit);
      }
      return send(baseUrl, 'POST', path, requestInit);
    },
    put: (path, body, init) => {
      const headers = resolveHeaders();
      const requestInit: RequestInit = mergeInit(init, headers);
      if (body !== undefined) {
        requestInit.body = headers['Content-Type'] === 'application/json' ? JSON.stringify(body) : (body as BodyInit);
      }
      return send(baseUrl, 'PUT', path, requestInit);
    },
    patch: (path, body, init) => {
      const headers = resolveHeaders();
      const requestInit: RequestInit = mergeInit(init, headers);
      if (body !== undefined) {
        requestInit.body = headers['Content-Type'] === 'application/json' ? JSON.stringify(body) : (body as BodyInit);
      }
      return send(baseUrl, 'PATCH', path, requestInit);
    },
    delete: (path, init) => {
      const headers = resolveHeaders();
      return send(baseUrl, 'DELETE', path, mergeInit(init, headers));
    },
  };
};
