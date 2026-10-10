import React, { useState, useEffect } from 'react';
import { mockUserProfile } from '../data/mockData';
import myAvatar from '../assets/avatar.jpg';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Mail, Phone, Code, Layout, FileText, GraduationCap, Users } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function Profile() {
    const { user: authUser, logout } = useAuth();
    const [profile, setProfile] = useState(mockUserProfile);

    // Tải thông tin người dùng thực tế từ Backend REST API (nếu có)
    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const res = await apiRequest('/auth/me');
                if (res) {
                    setProfile({
                        fullName: res.fullName || authUser?.fullName || mockUserProfile.fullName,
                        studentId: res.student_id || authUser?.student_id || mockUserProfile.studentId,
                        class: res.class || authUser?.class || mockUserProfile.class,
                        email: res.email || authUser?.email || mockUserProfile.email,
                        phone: res.phone || mockUserProfile.phone,
                        github: res.github || mockUserProfile.github,
                        figma: mockUserProfile.figma,
                        baocao: mockUserProfile.baocao
                    });
                }
            } catch (err) {
                // Giữ thông tin từ AuthContext / mockUserProfile khi Offline
                if (authUser) {
                    setProfile(prev => ({
                        ...prev,
                        fullName: authUser.fullName || prev.fullName,
                        studentId: authUser.student_id || prev.studentId,
                        class: authUser.class || prev.class,
                        email: authUser.email || prev.email,
                    }));
                }
            }
        };

        fetchUserProfile();
    }, [authUser]);

    return (
        <div className="max-w-2xl mx-auto py-4">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center space-y-6">

                {/* AVATAR & TIÊU ĐỀ */}
                <div className="flex flex-col items-center">
                    <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-blue-500 to-cyan-400 shadow-lg mb-4">
                        <img
                            src={myAvatar}
                            alt="Vũ Quang Huy Avatar"
                            className="w-full h-full rounded-full object-cover bg-white"
                        />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{profile.fullName}</h2>
                    <p className="text-xs text-blue-600 font-semibold mt-1">Mã SV: {profile.studentId}</p>
                </div>

                {/* THÔNG TIN CÁ NHÂN */}
                <div className="space-y-3 text-left border-t border-gray-100 pt-6">
                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <div className="flex items-center space-x-2 text-gray-500">
                            <User className="w-4 h-4" />
                            <span className="text-sm font-medium">Họ tên</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{profile.fullName}</span>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <div className="flex items-center space-x-2 text-gray-500">
                            <GraduationCap className="w-4 h-4" />
                            <span className="text-sm font-medium">Mã sinh viên</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{profile.studentId}</span>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <div className="flex items-center space-x-2 text-gray-500">
                            <Users className="w-4 h-4" />
                            <span className="text-sm font-medium">Lớp</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{profile.class}</span>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <div className="flex items-center space-x-2 text-gray-500">
                            <Mail className="w-4 h-4" />
                            <span className="text-sm font-medium">Email</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{profile.email}</span>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <div className="flex items-center space-x-2 text-gray-500">
                            <Phone className="w-4 h-4" />
                            <span className="text-sm font-medium">Số điện thoại</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{profile.phone}</span>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <div className="flex items-center space-x-2 text-gray-500">
                            <Code className="w-4 h-4" />
                            <span className="text-sm font-medium">GitHub</span>
                        </div>
                        <a href={profile.github?.startsWith('http') ? profile.github : `https://${profile.github}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:underline">
                            {profile.github}
                        </a>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <div className="flex items-center space-x-2 text-gray-500">
                            <Layout className="w-4 h-4" />
                            <span className="text-sm font-medium">Figma</span>
                        </div>
                        <a href={profile.figma?.startsWith('http') ? profile.figma : `https://${profile.figma}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:underline">
                            {profile.figma}
                        </a>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <div className="flex items-center space-x-2 text-gray-500">
                            <FileText className="w-4 h-4" />
                            <span className="text-sm font-medium">PDF Báo cáo</span>
                        </div>
                        <a href={profile.baocao?.startsWith('http') ? profile.baocao : `https://${profile.baocao}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:underline">
                            {profile.baocao}
                        </a>
                    </div>
                </div>

                {/* NÚT ĐĂNG XUẤT */}
                <div className="pt-4 border-t border-gray-100">
                    <button
                        onClick={logout}
                        className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-sm rounded-xl flex items-center justify-center space-x-2 transition-all shadow-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Đăng xuất tài khoản</span>
                    </button>
                </div>

            </div>
        </div>
    );
}