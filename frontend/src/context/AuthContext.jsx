// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { setAuthToken, apiRequest } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('user_info');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const [loading, setLoading] = useState(false);

    const login = async (username, password) => {
        setLoading(true);
        try {
            // Khi có backend, gọi API đăng nhập:
            // const res = await apiRequest('/auth/login', {
            //   method: 'POST',
            //   body: JSON.stringify({ username, password })
            // });
            // const { access_token, user_info } = res;

            // Giả lập response thành công:
            const access_token = 'mock_jwt_token_12345';
            const user_info = {
                username,
                fullName: 'Vũ Quang Huy',
                student_id: 'B23DCCN412',
                class: 'D23CQCN01-B',
                email: 'vuhuy1804@gmail.com'
            };

            setAuthToken(access_token);
            localStorage.setItem('user_info', JSON.stringify(user_info));
            setUser(user_info);
            return { success: true };
        } catch (err) {
            return { success: false, message: err.message || 'Đăng nhập thất bại' };
        } finally {
            setLoading(false);
        }
    };

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