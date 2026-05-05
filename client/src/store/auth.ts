import { create } from 'zustand';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
  username: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  loading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: localStorage.getItem('lomindil_token'),
  loading: true,

  setAuth: (user, token) => {
    localStorage.setItem('lomindil_token', token);
    set({ user, token, loading: false });
  },

  logout: () => {
    localStorage.removeItem('lomindil_token');
    set({ user: null, token: null, loading: false });
  },

  fetchMe: async () => {
    const token = localStorage.getItem('lomindil_token');
    if (!token) { set({ loading: false }); return; }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, token, loading: false });
    } catch {
      localStorage.removeItem('lomindil_token');
      set({ user: null, token: null, loading: false });
    }
  },
}));
