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
import { Thermometer, Sun, Droplets, Wind, Sliders, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '../services/api';

export default function Dashboard() {
    const [devices, setDevices] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [latestSensors, setLatestSensors] = useState({
        temperature: { current: 0, max_today: 0 },
        humidity: { current: 0, max_today: 0 },
        light: { current: 0, max_today: 0 },
        wind_speed: { current: 0, max_today: 0 }
    });
    const [toast, setToast] = useState(null);
    const [isWindAlert, setIsWindAlert] = useState(false);
    const [loadingDevices, setLoadingDevices] = useState({});

    const wsRef = useRef(null);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const fetchInitialData = async () => {
        try {
            const [statRes, devicesRes, chartRes] = await Promise.all([
                apiRequest('/sensors/latest'),
                apiRequest('/devices/'),
                apiRequest('/sensors/chart-history')
            ]);

            if (statRes) {
                setLatestSensors(statRes);
                if (statRes.wind_speed?.current > 300) {
                    setIsWindAlert(true);
                }
            }
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

    useEffect(() => {
        fetchInitialData();

        const wsUrl = `ws://localhost:8000/ws/dashboard`;

        try {
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onmessage = (event) => {
                const message = JSON.parse(event.data);

                if (message.type === 'SENSOR_UPDATE') {
                    const data = message.data;
                    const tempVal = data.temperature;
                    const humVal = data.humidity;
                    const luxVal = data.light;
                    const windVal = data.wind_speed;

                    // Kích hoạt nhấp nháy StatCard khi Tốc độ gió > 300 m/s
                    if (windVal > 300 || data.is_alert) {
                        setIsWindAlert(true);
                    } else {
                        setIsWindAlert(false);
                    }

                    setLatestSensors(prev => ({
                        temperature: {
                            current: tempVal ?? prev.temperature.current,
                            max_today: Math.max(tempVal || 0, prev.temperature.max_today)
                        },
                        light: {
                            current: luxVal ?? prev.light.current,
                            max_today: Math.max(luxVal || 0, prev.light.max_today)
                        },
                        humidity: {
                            current: humVal ?? prev.humidity.current,
                            max_today: Math.max(humVal || 0, prev.humidity.max_today)
                        },
                        wind_speed: {
                            current: windVal ?? prev.wind_speed?.current ?? 0,
                            max_today: Math.max(windVal || 0, prev.wind_speed?.max_today || 0)
                        }
                    }));

                    const now = new Date();
                    const timeStr = now.toTimeString().split(' ')[0];

                    const newPoint = {
                        time: timeStr,
                        temp: tempVal,
                        hum: humVal,
                        lux: luxVal,
                        wind: windVal
                    };

                    setChartData(prev => {
                        const updated = [...prev, newPoint];
                        return updated.slice(-12);
                    });
                }

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
        } catch (e) {
            console.error('Không thể kết nối WebSocket:', e);
        }

        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, []);

    const handleToggleDevice = async (id) => {
        if (loadingDevices[id]) return;

        const targetDev = devices.find((d) => d.id === id);
        if (!targetDev) return;

        const newStatus = !targetDev.status;
        const actionWord = newStatus ? 'Bật' : 'Tắt';
        const msg = `${actionWord} ${targetDev.name} thành công`;
        const startTime = Date.now();

        setLoadingDevices(prev => ({ ...prev, [id]: true }));

        try {
            await apiRequest('/devices/control', {
                method: 'POST',
                body: JSON.stringify({
                    device_id: id,
                    action: newStatus ? 'ON' : 'OFF'
                })
            });

            const elapsedTime = Date.now() - startTime;
            if (elapsedTime < 500) {
                await new Promise(resolve => setTimeout(resolve, 500 - elapsedTime));
            }

            setDevices(prev => prev.map(dev => dev.id === id ? { ...dev, status: newStatus } : dev));
            setToast({ type: 'success', message: msg });
        } catch (err) {
            setToast({ type: 'error', message: `${actionWord} ${targetDev.name} thất bại!` });
        } finally {
            setLoadingDevices(prev => ({ ...prev, [id]: false }));
        }
    };

    return (
        <div className="space-y-4 relative overflow-hidden">
            {/* TOAST THÔNG BÁO */}
            {toast && (
                <div className="fixed top-16 right-6 z-50 flex items-center space-x-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl transition-all animate-bounce">
                    {toast.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                    <span className="text-xs font-medium">{toast.message}</span>
                </div>
            )}

            {/* 4 STAT CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Độ ẩm</p>
                        <h3 className="text-2xl font-bold text-gray-900">{latestSensors.humidity.current}%</h3>
                        <p className="text-[11px] text-gray-400 mt-1">Cao nhất hôm nay: {latestSensors.humidity.max_today}%</p>
                    </div>
                    <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center text-cyan-500">
                        <Droplets className="w-5 h-5" />
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

                {/* STAT CARD TỐC ĐỘ GIÓ: CHỈ NHẤP NHÁY ĐỎ TẠI ĐÂY KHI GIÓ > 300 */}
                <div className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all duration-300 ${isWindAlert
                        ? 'bg-rose-100 border-2 border-rose-500 text-rose-900 animate-pulse'
                        : 'bg-white border-gray-100'
                    }`}>
                    <div>
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Tốc độ gió (Wind Speed)</p>
                        <h3 className={`text-2xl font-bold ${isWindAlert ? 'text-rose-600' : 'text-gray-900'}`}>
                            {latestSensors.wind_speed?.current || 0} m/s
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-1">Cao nhất hôm nay: {latestSensors.wind_speed?.max_today || 0} m/s</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isWindAlert ? 'bg-rose-500 text-white' : 'bg-teal-50 text-teal-600'
                        }`}>
                        <Wind className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* CHARTS & CONTROL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-800 mb-2 tracking-wide uppercase">BIỂU ĐỒ NHIỆT ĐỘ & ĐỘ ẨM</h4>
                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
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
                        <h4 className="text-xs font-bold text-gray-800 mb-2 tracking-wide uppercase">BIỂU ĐỒ ÁNH SÁNG & TỐC ĐỘ GIÓ</h4>
                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 1000]} />
                                    <Tooltip />
                                    <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px' }} />
                                    <Line type="monotone" dataKey="lux" name="Ánh sáng (lux)" stroke="#eab308" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} />
                                    <Line type="monotone" dataKey="wind" name="Tốc độ gió (m/s)" stroke="#e11d48" strokeWidth={2} isAnimationActive={false} dot={{ r: 2.5 }} />
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
                        {devices.map((device) => {
                            const isLoading = loadingDevices[device.id];

                            return (
                                <div key={device.id} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex items-center space-x-3">
                                        <div className={`p-2 rounded-lg ${device.status ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                                            <Sliders className="w-4 h-4" />
                                        </div>
                                        <span className="font-semibold text-xs text-gray-700">{device.name}</span>
                                    </div>
                                    <button
                                        onClick={() => handleToggleDevice(device.id)}
                                        disabled={isLoading}
                                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 relative ${isLoading
                                            ? 'bg-blue-400 opacity-80 cursor-not-allowed'
                                            : device.status ? 'bg-blue-600' : 'bg-gray-300'
                                            }`}
                                    >
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${device.status ? 'translate-x-5' : 'translate-x-0'}`}>
                                            {isLoading && (
                                                <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-600" />
                                            )}
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}