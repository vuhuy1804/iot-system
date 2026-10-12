import React, { useState, useEffect } from 'react';
import { mockUserProfile } from '../data/mockData';
import myAvatar from '../assets/avatar.jpg'; // Ảnh mặc định Fallback
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function Profile() {
    const { user: authUser, logout } = useAuth();
    const [profile, setProfile] = useState(mockUserProfile);

    // Tải thông tin người dùng từ Backend REST API
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
                        avatar: res.avatar || null, // Nhận avatar từ API Backend
                        github: mockUserProfile.github,
                        figma: mockUserProfile.figma,
                        baocao: mockUserProfile.baocao
                    });
                }
            } catch (err) {
                if (authUser) {
                    setProfile(prev => ({
                        ...prev,
                        fullName: authUser.fullName || prev.fullName,
                        studentId: authUser.student_id || prev.studentId,
                        class: authUser.class || prev.class,
                        email: authUser.email || prev.email,
                        avatar: authUser.avatar || null
                    }));
                }
            }
        };

        fetchUserProfile();
    }, [authUser]);

    // Hàm ghép URL ảnh từ Backend FastAPI
    const getAvatarSrc = () => {
        if (!profile.avatar) return myAvatar;
        // Nếu avatar là URL tuyệt đối (http://...) thì giữ nguyên, nếu là chuỗi /static/... thì nối host FastAPI
        if (profile.avatar.startsWith('http')) return profile.avatar;
        return `http://localhost:8000${profile.avatar}`;
    };

    return (
        <div className="max-w-2xl mx-auto py-4">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center space-y-6">

                {/* AVATAR & TIÊU ĐỀ */}
                <div className="flex flex-col items-center">
                    <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-blue-500 to-cyan-400 shadow-lg mb-4">
                        <img
                            src={getAvatarSrc()}
                            alt={`${profile.fullName || 'User'} Avatar`}
                            className="w-full h-full rounded-full object-cover bg-white"
                            onError={(e) => {
                                e.target.src = myAvatar; // Tự động nảy về ảnh local nếu đường dẫn static bị lỗi
                            }}
                        />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">{profile.fullName}</h2>
                </div>

                {/* THÔNG TIN CÁ NHÂN */}
                <div className="space-y-3 text-left border-t border-gray-100 pt-6">
                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <span className="text-sm font-medium text-gray-500">Họ tên</span>
                        <span className="text-sm font-bold text-gray-900">{profile.fullName}</span>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <span className="text-sm font-medium text-gray-500">Mã sinh viên</span>
                        <span className="text-sm font-bold text-gray-900">{profile.studentId}</span>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <span className="text-sm font-medium text-gray-500">Lớp</span>
                        <span className="text-sm font-bold text-gray-900">{profile.class}</span>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <span className="text-sm font-medium text-gray-500">Email</span>
                        <span className="text-sm font-semibold text-gray-800">{profile.email}</span>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <span className="text-sm font-medium text-gray-500">Số điện thoại</span>
                        <span className="text-sm font-bold text-gray-900">{profile.phone}</span>
                    </div>

                    {/* LIÊN KẾT TÀI NGUYÊN DỰ ÁN */}
                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <span className="text-sm font-medium text-gray-500">GitHub</span>
                        <a href={profile.github?.startsWith('http') ? profile.github : `https://${profile.github}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:underline">
                            Github
                        </a>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <span className="text-sm font-medium text-gray-500">Figma</span>
                        <a href={profile.figma?.startsWith('http') ? profile.figma : `https://${profile.figma}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:underline">
                            Figma
                        </a>
                    </div>

                    <div className="flex justify-between items-center p-3.5 bg-gray-50/80 rounded-xl">
                        <span className="text-sm font-medium text-gray-500">PDF Báo cáo</span>
                        <a href={profile.baocao?.startsWith('http') ? profile.baocao : `https://${profile.baocao}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:underline">
                            PDFBaoCao
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