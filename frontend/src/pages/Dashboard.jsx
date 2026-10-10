import React, { useState, useEffect, useRef } from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import { Thermometer, Sun, Droplets, Lightbulb, Sliders, CheckCircle, AlertCircle, WifiOff } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function Dashboard() {
    const [devices, setDevices] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [latestSensors, setLatestSensors] = useState({
        temperature: { current: 0, max_today: 0 },
        humidity: { current: 0, max_today: 0 },
        light: { current: 0 }
    });
    const [toast, setToast] = useState(null);
    const [isConnected, setIsConnected] = useState(true);

    const wsRef = useRef(null);
    const sensorTimeoutRef = useRef(null);

    // Toast auto-dismiss sau 3 giây
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // Hàm đếm ngược kiểm tra mất kết nối cảm biến (6 giây)
    const resetSensorTimeout = () => {
        setIsConnected(true);
        if (sensorTimeoutRef.current) clearTimeout(sensorTimeoutRef.current);

        sensorTimeoutRef.current = setTimeout(() => {
            setIsConnected(false);
        }, 6000);
    };

    // 1. Lấy dữ liệu khởi tạo từ Backend REST API
    const fetchInitialData = async () => {
        try {
            const [statRes, devicesRes, chartRes] = await Promise.all([
                apiRequest('/sensors/latest'),
                apiRequest('/devices/'),
                apiRequest('/sensors/chart-history')
            ]);

            if (statRes) setLatestSensors(statRes);
            if (devicesRes) {
                const formattedDevices = devicesRes.map(d => ({
                    ...d,
                    status: typeof d.status === 'boolean' ? d.status : d.status === 'ON'
                }));
                setDevices(formattedDevices);
            }
            if (chartRes && chartRes.length > 0) {
                setChartData(chartRes);
            }
        } catch (err) {
            console.error('Lỗi kết nối Backend REST API:', err);
        }
    };

    // 2. Kết nối WebSocket Realtime với FastAPI Server
    useEffect(() => {
        fetchInitialData();

        const wsUrl = `ws://localhost:8000/ws/dashboard`;

        try {
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onmessage = (event) => {
                const message = JSON.parse(event.data);

                // A. NHẬN DỮ LIỆU CẢM BIẾN REALTIME
                if (message.type === 'SENSOR_UPDATE') {
                    resetSensorTimeout(); // Xác nhận hệ thống cảm biến đang sống

                    const data = message.data;
                    const tempVal = data.temperature;
                    const humVal = data.humidity;
                    const luxVal = data.light;

                    // Cập nhật Stat Cards
                    setLatestSensors(prev => ({
                        temperature: {
                            current: tempVal ?? prev.temperature.current,
                            max_today: Math.max(tempVal || 0, prev.temperature.max_today)
                        },
                        light: {
                            current: luxVal ?? prev.light.current
                        },
                        humidity: {
                            current: humVal ?? prev.humidity.current,
                            max_today: Math.max(humVal || 0, prev.humidity.max_today)
                        }
                    }));

                    // Cập nhật điểm dữ liệu mới vào Biểu đồ
                    const now = new Date();
                    const timeStr = now.toTimeString().split(' ')[0];

                    const newPoint = {
                        time: timeStr,
                        temp: tempVal,
                        hum: humVal,
                        lux: luxVal
                    };

                    setChartData(prev => {
                        const updated = [...prev, newPoint];
                        return updated.slice(-12);
                    });
                }

                // B. NHẬN PHẢN HỒI THỰC TẾ TRẠNG THÁI THIẾT BỊ TỪ ESP32
                if (message.type === 'DEVICE_UPDATE') {
                    const { device_id, status, is_success } = message.data;

                    setDevices(prev => prev.map(d => {
                        if (d.id === device_id) {
                            return { ...d, status: status === 'ON' };
                        }
                        return d;
                    }));

                    if (is_success === false) {
                        const target = devices.find(d => d.id === device_id);
                        const devName = target ? target.name : 'thiết bị';
                        setToast({ type: 'error', message: `Điều khiển ${devName} thất bại!` });
                    }
                }
            };

            wsRef.current.onerror = (err) => {
                console.error('WebSocket Error:', err);
                setIsConnected(false);
            };
        } catch (e) {
            console.error('Không thể tạo kết nối WebSocket:', e);
            setIsConnected(false);
        }

        return () => {
            if (wsRef.current) wsRef.current.close();
            if (sensorTimeoutRef.current) clearTimeout(sensorTimeoutRef.current);
        };
    }, []);

    // 3. Điều khiển Bật/Tắt Đèn LED qua REST API & MQTT
    const handleToggleDevice = async (id) => {
        const targetDev = devices.find((d) => d.id === id);
        if (!targetDev) return;

        const newStatus = !targetDev.status;
        const actionWord = newStatus ? 'Bật' : 'Tắt';
        const msg = `${actionWord} ${targetDev.name} thành công`;

        // Optimistic UI Update tạm thời
        setDevices(prev => prev.map(dev => dev.id === id ? { ...dev, status: newStatus } : dev));

        try {
            await apiRequest('/devices/control', {
                method: 'POST',
                body: JSON.stringify({
                    device_id: id,
                    action: newStatus ? 'ON' : 'OFF'
                })
            });
            setToast({ type: 'success', message: msg });
        } catch (err) {
            // ROLLBACK UI: Giữ nguyên trạng thái cũ nếu API/MQTT báo lỗi
            setDevices(prev => prev.map(dev => dev.id === id ? { ...dev, status: !newStatus } : dev));
            setToast({ type: 'error', message: `${actionWord} ${targetDev.name} thất bại!` });
        }
    };

    return (
        <div className="space-y-4 relative overflow-hidden">
            {/* CẢNH BÁO MẤT KẾT NỐI CẢM BIẾN / ESP32 */}
            {!isConnected && (
                <div className="bg-rose-500 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between animate-pulse">
                    <div className="flex items-center space-x-3">
                        <WifiOff className="w-5 h-5 text-white" />
                        <span className="text-xs font-bold uppercase tracking-wider">
                            Cảnh báo: Không thể kết nối tới Cảm biến / ESP32! Dữ liệu thời gian thực đang tạm dừng.
                        </span>
                    </div>
                </div>
            )}

            {/* TOAST THÔNG BÁO */}
            {toast && (
                <div className="fixed top-16 right-6 z-50 flex items-center space-x-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl transition-all animate-bounce">
                    {toast.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                    <span className="text-xs font-medium">{toast.message}</span>
                </div>
            )}

            {/* STAT CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Nhiệt độ</p>
                        <h3 className="text-2xl font-bold text-gray-900">{latestSensors.temperature.current}°C</h3>
                        <p className="text-[11px] text-gray-400 mt-1">Cao nhất hôm nay: {latestSensors.temperature.max_today}°C</p>
                    </div>
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
                        <Thermometer className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Ánh sáng</p>
                        <h3 className="text-2xl font-bold text-gray-900">{latestSensors.light.current} lux</h3>
                        <p className="text-[11px] text-gray-400 mt-1">Cao nhất hôm nay: {latestSensors.light.max_today} lux</p>
                    </div>
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                        <Sun className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Độ ẩm</p>
                        <h3 className="text-2xl font-bold text-gray-900">{latestSensors.humidity.current}%</h3>
                        <p className="text-[11px] text-gray-400 mt-1">Cao nhất hôm nay: {latestSensors.humidity.max_today}%</p>
                    </div>
                    <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center text-cyan-500">
                        <Droplets className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* CHARTS & CONTROL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-800 mb-2 tracking-wide uppercase">BIỂU ĐỒ NHIỆT ĐỘ & ĐỘ ẨM REALTIME</h4>
                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} interval={0} minTickGap={0} />
                                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                                    <Tooltip />
                                    <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px' }} />
                                    <Line type="monotone" dataKey="temp" name="Nhiệt độ (°C)" stroke="#f97316" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} />
                                    <Line type="monotone" dataKey="hum" name="Độ ẩm (%)" stroke="#06b6d4" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-800 mb-2 tracking-wide uppercase">BIỂU ĐỒ ĐỘ SÁNG REALTIME</h4>
                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} interval={0} minTickGap={0} />
                                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 1000]} />
                                    <Tooltip />
                                    <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px' }} />
                                    <Line type="monotone" dataKey="lux" name="Ánh sáng (lux)" stroke="#eab308" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-start">
                    <div className="flex items-center space-x-2 text-blue-600 mb-4">
                        <Sliders className="w-4 h-4" />
                        <h4 className="text-xs font-bold text-gray-800 tracking-wide uppercase">ĐIỀU KHIỂN THIẾT BỊ</h4>
                    </div>

                    <div className="space-y-3">
                        {devices.map((device) => (
                            <div key={device.id} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center space-x-3">
                                    <div className={`p-2 rounded-lg ${device.status ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                                        <Lightbulb className="w-4 h-4" />
                                    </div>
                                    <span className="font-semibold text-xs text-gray-700">{device.name}</span>
                                </div>
                                <button
                                    onClick={() => handleToggleDevice(device.id)}
                                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${device.status ? 'bg-blue-600' : 'bg-gray-300'}`}
                                >
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${device.status ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}