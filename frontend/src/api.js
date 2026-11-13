// src/api.js
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const authAxios = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});
authAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  login: (email, password) => authAxios.post('/api/ticketing/auth/login', { email, password }),
  register: (data) => authAxios.post('/api/ticketing/auth/register', data),
  // NEW — Google sign-in
  googleLogin: (idToken) => authAxios.post('/api/auth/google', { id_token: idToken }),
};

export const shopAPI = {
  listAdverts: (params) => api.get('/ecommerce/adverts', { params }),
  getAdvert: (id) => api.get(`/ecommerce/adverts/${id}`),
  getMatchAdverts: (matchId) => api.get(`/ecommerce/matches/${matchId}/adverts`),
  listCategories: () => api.get('/ecommerce/categories'),
  listVendors: (params) => api.get('/ecommerce/vendors', { params }),
  getVendor: (id) => api.get(`/ecommerce/vendors/${id}`),
  getSettings: () => api.get('/ecommerce/settings/public'),
};

export const orderAPI = {
  checkout: (data) => api.post('/ecommerce/checkout', data),
  getByNumber: (orderNumber) => api.get(`/ecommerce/orders/${orderNumber}`),
  listMyOrders: () => api.get('/ecommerce/orders'),
  confirmReceipt: (orderNumber) => api.put(`/ecommerce/orders/${orderNumber}/confirm-receipt`),
  getProviders: () => api.get('/ecommerce/payment/providers'),
  initiatePayment: (data) => api.post('/ecommerce/payment/initiate', data),
  checkStatus: (depositId) => api.get(`/ecommerce/payment/deposit/${depositId}/check`),
};

export default api;