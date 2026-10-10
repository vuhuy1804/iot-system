import React, { useState, useEffect, useCallback } from 'react';
import { Clock, RotateCw } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function ActionHistory() {
    const [dataList, setDataList] = useState([]);
    const [searchTime, setSearchTime] = useState('');
    const [deviceFilter, setDeviceFilter] = useState('Tất cả');
    const [actionFilter, setActionFilter] = useState('Tất cả');
    const [statusFilter, setStatusFilter] = useState('Tất cả');
    const [sortBy, setSortBy] = useState('time_desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);

    // Call REST API Backend kết nối MySQL
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: currentPage,
                limit: itemsPerPage,
                searchTime: searchTime.trim(),
                device: deviceFilter,
                action: actionFilter,
                status: statusFilter,
                sortBy: sortBy
            });

            const res = await apiRequest(`/devices/actions/history?${queryParams.toString()}`);
            if (res && res.data) {
                const uniqueMap = new Map();
                res.data.forEach((item) => {
                    if (!uniqueMap.has(item.id)) {
                        uniqueMap.set(item.id, {
                            ...item,
                            user: item.fullName || item.username || item.user || 'Vũ Quang Huy'
                        });
                    }
                });
                setDataList(Array.from(uniqueMap.values()));
                setTotalPages(res.totalPages || 1);
            } else {
                setDataList([]);
                setTotalPages(1);
            }
        } catch (err) {
            console.error("Lỗi kết nối API Action History:", err);
            setDataList([]);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, searchTime, deviceFilter, actionFilter, statusFilter, sortBy]);

    useEffect(() => {
        loadData();
    }, [currentPage, itemsPerPage, deviceFilter, actionFilter, statusFilter, sortBy, loadData]);

    return (
        <div className="space-y-6">
            {/* TOOLBAR TÌM KIẾM & BỘ LỌC */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Tìm theo thời gian (VD: 2026-10-25)..."
                        value={searchTime}
                        onChange={(e) => { setSearchTime(e.target.value); setCurrentPage(1); }}
                        onKeyDown={(e) => e.key === 'Enter' && loadData()}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                <select
                    value={deviceFilter}
                    onChange={(e) => { setDeviceFilter(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium focus:outline-none"
                >
                    <option value="Tất cả">Thiết bị: Tất cả</option>
                    <option value="Đèn led 1">Đèn led 1</option>
                    <option value="Đèn led 2">Đèn led 2</option>
                </select>

                <select
                    value={actionFilter}
                    onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium focus:outline-none"
                >
                    <option value="Tất cả">Hành động: Tất cả</option>
                    <option value="Bật đèn">Bật đèn</option>
                    <option value="Tắt đèn">Tắt đèn</option>
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium focus:outline-none"
                >
                    <option value="Tất cả">Trạng thái: Tất cả</option>
                    <option value="Thành công">Thành công</option>
                    <option value="Thất bại">Thất bại</option>
                </select>

                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-medium focus:outline-none"
                >
                    <option value="time_desc">Thời gian: Mới nhất</option>
                    <option value="time_asc">Thời gian: Cũ nhất</option>
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

            {/* BẢNG LỊCH SỬ THAO TÁC */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4 tracking-wide uppercase">ACTION HISTORY</h3>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                <th className="py-3 px-4">ID</th>
                                <th className="py-3 px-4">Tên thiết bị</th>
                                <th className="py-3 px-4">Hành động</th>
                                <th className="py-3 px-4">Người thực hiện</th>
                                <th className="py-3 px-4">Trạng thái</th>
                                <th className="py-3 px-4">Thời gian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                            {dataList.length > 0 ? (
                                dataList.map((row, index) => (
                                    <tr key={`${row.id}-${index}`} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-3.5 px-4 font-semibold text-gray-900">{row.id}</td>
                                        <td className="py-3.5 px-4 font-bold text-gray-800">{row.device}</td>
                                        <td className="py-3.5 px-4 font-medium text-gray-700">{row.action}</td>
                                        <td className="py-3.5 px-4 font-semibold text-blue-600">{row.user}</td>
                                        <td className="py-3.5 px-4">
                                            <span className={row.status === 'Thành công' ? 'text-emerald-500 font-medium' : 'text-rose-500 font-medium'}>
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-gray-500">{row.time}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="py-8 text-center text-gray-400 text-xs">
                                        {loading ? 'Đang tải lịch sử thao tác...' : 'Không tìm thấy bản ghi phù hợp trong CSDL MySQL.'}
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