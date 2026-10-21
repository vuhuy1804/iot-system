import React, { useState, useEffect, useCallback } from 'react';
import { Search, RotateCw, Copy, Check } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function DataHistory() {
    const [dataList, setDataList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchCategory, setSearchCategory] = useState('Tất cả');
    const [sortBy, setSortBy] = useState('time_desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);

    // State lưu ID của hàng vừa copy để đổi icon phản hồi
    const [copiedId, setCopiedId] = useState(null);

    const handleCopyTime = (timeStr, id) => {
        if (!timeStr) return;
        navigator.clipboard.writeText(timeStr);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    // Call API REST Backend kết nối trực tiếp MySQL
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: currentPage,
                limit: itemsPerPage,
                category: searchCategory,
                search: searchTerm.trim(),
                sortBy: sortBy
            });

            const res = await apiRequest(`/sensors/history?${queryParams.toString()}`);
            if (res && res.data) {
                setDataList(res.data);
                setTotalPages(res.totalPages || 1);
            } else {
                setDataList([]);
                setTotalPages(1);
            }
        } catch (err) {
            console.error("Lỗi kết nối API Sensor History:", err);
            setDataList([]);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, searchCategory, searchTerm, sortBy]);

    useEffect(() => {
        loadData();
    }, [currentPage, itemsPerPage, searchCategory, sortBy, loadData]);

    return (
        <div className="space-y-6">
            {/* TOOLBAR TÌM KIẾM & LỌC */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
                <select
                    value={searchCategory}
                    onChange={(e) => { setSearchCategory(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none"
                >
                    <option value="Tất cả">Tìm kiếm: Tất cả</option>
                    <option value="Thời gian">Chỉ tìm: Thời gian</option>
                    <option value="Nhiệt độ">Chỉ tìm: Nhiệt độ</option>
                    <option value="Độ ẩm">Chỉ tìm: Độ ẩm</option>
                    <option value="Ánh sáng">Chỉ tìm: Ánh sáng</option>
                </select>

                <div className="relative flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder={
                            searchCategory === 'Thời gian' ? 'Nhập thời gian (VD: 2026-10, 10:05)...' :
                                searchCategory === 'Tất cả' ? 'Nhập giá trị hoặc thời gian...' : `Nhập giá trị ${searchCategory.toLowerCase()}...`
                        }
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        onKeyDown={(e) => e.key === 'Enter' && loadData()}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none"
                >
                    <option value="time_desc">Thời gian: Mới nhất</option>
                    <option value="time_asc">Thời gian: Cũ nhất</option>
                    <option value="val_asc">Giá trị: Tăng dần</option>
                    <option value="val_desc">Giá trị: Giảm dần</option>
                </select>

                <button
                    onClick={loadData}
                    disabled={loading}
                    className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-medium text-sm flex items-center space-x-1 transition-all disabled:opacity-50"
                    title="Tải lại dữ liệu"
                >
                    <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* BẢNG DỮ LIỆU */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4 tracking-wide uppercase">DATA SENSOR</h3>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                <th className="py-3 px-4">ID</th>
                                <th className="py-3 px-4">Loại cảm biến</th>
                                <th className="py-3 px-4">Giá trị</th>
                                <th className="py-3 px-4">Thời gian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                            {dataList.length > 0 ? (
                                dataList.map((row, index) => (
                                    <tr key={`${row.id}-${index}`} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3.5 px-4 font-semibold text-gray-900">{row.id}</td>
                                        <td className="py-3.5 px-4 font-semibold text-gray-800">{row.type}</td>
                                        <td className="py-3.5 px-4 font-bold text-blue-600">{row.value}</td>
                                        <td className="py-3.5 px-4 text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <span>{row.time}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyTime(row.time, row.id)}
                                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="Sao chép thời gian"
                                                >
                                                    {copiedId === row.id ? (
                                                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="py-8 text-center text-gray-400 text-xs">
                                        {loading ? 'Đang tải dữ liệu...' : 'Không tìm thấy bản ghi phù hợp trong CSDL MySQL.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* CHÂN TRANG PHÂN TRANG */}
                <div className="flex flex-wrap items-center justify-between mt-6 pt-4 border-t border-gray-100 text-sm text-gray-500 gap-3">
                    <div className="flex items-center space-x-3">
                        <span>Trang <strong className="text-gray-900">{currentPage}</strong> / {totalPages}</span>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md font-bold">
                            {dataList.length} / {itemsPerPage}
                        </span>

                        <div className="flex items-center space-x-1 pl-2">
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={20}>20</option>
                                <option value={25}>25</option>
                                <option value={30}>30</option>
                            </select>
                            <span className="text-xs text-gray-500 font-medium">/ trang</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1 || loading}
                            className="px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-100 disabled:opacity-40 transition-all"
                        >
                            Trang đầu
                        </button>
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            disabled={currentPage === 1 || loading}
                            className="px-3.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-40 transition-all"
                        >
                            [-] Trước
                        </button>
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                            disabled={currentPage === totalPages || loading}
                            className="px-3.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 disabled:opacity-40 transition-all"
                        >
                            [+] Sau
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages || loading}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 disabled:opacity-40 transition-all"
                        >
                            Trang cuối
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}