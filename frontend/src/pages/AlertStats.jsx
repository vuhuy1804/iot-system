import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function AlertStats() {
    const [alertData, setAlertData] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadAlertStats = async () => {
        setLoading(true);
        try {
            const res = await apiRequest('/sensors/alerts/monthly');
            if (res) {
                setAlertData(res);
            }
        } catch (err) {
            console.error('Lỗi lấy thống kê cảnh báo:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAlertStats();
    }, []);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">THỐNG KÊ CẢNH BÁO TỐC ĐỘ GIÓ (&gt; 300 m/s)</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Số lượt phát sinh cảnh báo theo các ngày trong tháng</p>
                    </div>
                </div>

                <button
                    onClick={loadAlertStats}
                    disabled={loading}
                    className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-medium text-sm flex items-center space-x-1 transition-all"
                >
                    <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={alertData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                            <Tooltip />
                            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '12px' }} />
                            <Bar dataKey="count" name="Số lượt cảnh báo / ngày" fill="#e11d48" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}