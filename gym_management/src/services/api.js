function resolveApiBase() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (
    !envUrl ||
    envUrl.includes('gym-management-api.vercel.app') ||
    (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app'))
  ) {
    return '/api';
  }
  return envUrl;
}

const API_BASE = resolveApiBase();

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = localStorage.getItem('gym_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          localStorage.removeItem('gym_token');
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        const error = new Error(data?.message || 'An error occurred');
        error.status = response.status;
        error.errors = data?.errors;
        throw error;
      }

      return data?.data !== undefined ? data.data : data;
    } catch (err) {
      throw err;
    }
  }

  get(endpoint, params) {
    let url = endpoint;
    if (params) {
      const query = new URLSearchParams();
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, val);
        }
      }
      const qs = query.toString();
      if (qs) url += `?${qs}`;
    }
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  }

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  }

  patch(endpoint, body) {
    return this.request(endpoint, { method: 'PATCH', body });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

