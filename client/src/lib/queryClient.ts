import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let text = res.statusText;
    try {
      text = (await res.text()) || res.statusText;
    } catch (e) {
      // ignore
    }
    console.error(`API Error: ${res.status} ${text} for ${res.url}`);
    throw new Error(`${res.status}: ${text}`);
  }
}

export function getIsElectron() {
  return window.navigator.userAgent.toLowerCase().includes('electron') || (window as any).electron !== undefined;
}

export function getBaseUrl() {
  return getIsElectron() ? 'http://127.0.0.1:7016' : '';
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getBaseUrl();
  const fullUrl = url.startsWith('/') ? `${baseUrl}${url}` : url;

  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Handle query key properly - first item is the base URL
    let url = queryKey[0] as string;
    
    // If there are additional parameters, construct query string
    if (queryKey.length > 1 && queryKey[1] && typeof queryKey[1] === 'object') {
      const params = queryKey[1] as Record<string, string>;
      const searchParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value && value.trim() !== '' && value !== 'all') {
          searchParams.append(key, value);
        }
      });
      
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    
    const baseUrl = getBaseUrl();
    const fullUrl = url.startsWith('/') ? `${baseUrl}${url}` : url;

    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
