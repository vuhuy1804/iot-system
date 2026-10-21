import React, { createContext, useState, useContext, useEffect } from 'react';
import { setAuthToken, getAuthToken, apiRequest } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Kiểm tra và khôi phục phiên đăng nhập khi F5 hoặc mở lại ứng dụng
    useEffect(() => {
        const initAuth = async () => {
            const token = getAuthToken();

            // Nếu không có token hoặc đang dính token giả lập 'mock' cũ -> Dọn dẹp storage
            if (!token || token.includes('mock') || token === 'undefined' || token === '[object Object]') {
                setAuthToken(null);
                localStorage.removeItem('user_info');
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                // Lấy thông tin profile thực tế từ token JWT
                const userProfile = await apiRequest('/auth/me');
                setUser(userProfile);
            } catch (err) {
                console.error("Lỗi khôi phục phiên đăng nhập:", err);
                setAuthToken(null);
                localStorage.removeItem('user_info');
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    // Hàm Đăng nhập kết nối REST API Backend
    const login = async (username, password) => {
        setLoading(true);
        try {
            // 1. Gọi API đăng nhập thật
            const res = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            const { access_token, user_info } = res;

            if (!access_token) {
                throw new Error('Không nhận được access_token từ Backend!');
            }

            // 2. Lưu chuỗi JWT thật vào localStorage
            setAuthToken(access_token);
            localStorage.setItem('user_info', JSON.stringify(user_info));

            // 3. Truy vấn ngay thông tin Profile chi tiết từ /auth/me
            try {
                const profile = await apiRequest('/auth/me');
                setUser(profile);
            } catch {
                setUser(user_info);
            }

            return { success: true };
        } catch (err) {
            return { success: false, message: err.message || 'Đăng nhập thất bại' };
        } finally {
            setLoading(false);
        }
    };

    // Hàm Đăng xuất
    const logout = () => {
        setAuthToken(null);
        localStorage.removeItem('user_info');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);