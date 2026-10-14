import axios from 'axios';

export function errorMessage(error: unknown, fallback = 'Request failed. Please try again.'): string {
  if (axios.isAxiosError<{ error?: string; message?: string }>(error)) {
    return error.response?.data?.error || error.response?.data?.message || (error.code === 'ECONNABORTED' ? 'The request timed out. Your saved answers are safe. Please retry.' : fallback);
  }
  return error instanceof Error ? error.message : fallback;
}
