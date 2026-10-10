// src/services/api.js
const API_BASE_URL = 'http://localhost:8000/api';

export const getAuthToken = () => localStorage.getItem('access_token');

export const setAuthToken = (token) => {
    if (token) {
        localStorage.setItem('access_token', token);
    } else {
        localStorage.removeItem('access_token');
    }
};

export const apiRequest = async (endpoint, options = {}) => {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // Token hết hạn hoặc không hợp lệ -> Đăng xuất
        setAuthToken(null);
        localStorage.removeItem('user_info');
        window.location.href = '/login';
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Có lỗi xảy ra khi gọi API');
    }

    return response.json();
};