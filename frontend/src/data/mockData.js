// src/data/mockData.js

export const mockLatestSensors = {
    temperature: { current: 28.0, max_today: 35.0, unit: "°C" },
    light: { current: 500.0, unit: "lux" },
    humidity: { current: 60.0, max_today: 75.0, unit: "%" }
};

export const mockInitialDevices = [
    { id: 1, name: "Đèn led 1", status: true },
    { id: 2, name: "Đèn led 2", status: true }
];

export const mockSensorHistory = [
    { id: 101, type: "Nhiệt độ", value: "29.5°C", numValue: 29.5, time: "2026-01-25 10:05:22" },
    { id: 102, type: "Ánh sáng", value: "500 lux", numValue: 500, time: "2026-01-25 10:05:20" },
    { id: 103, type: "Độ ẩm", value: "61%", numValue: 61, time: "2026-01-25 10:05:18" },
    { id: 104, type: "Nhiệt độ", value: "30.2°C", numValue: 30.2, time: "2026-01-25 10:05:16" },
    { id: 105, type: "Độ ẩm", value: "59%", numValue: 59, time: "2026-01-25 10:05:14" },
    { id: 106, type: "Ánh sáng", value: "510 lux", numValue: 510, time: "2026-01-25 10:05:12" },
    { id: 107, type: "Nhiệt độ", value: "30.0°C", numValue: 30.0, time: "2026-01-25 10:05:10" },
    { id: 108, type: "Độ ẩm", value: "60%", numValue: 60, time: "2026-01-25 10:05:08" },
];

export const mockActionHistory = [
    { id: 201, device: "Đèn led 1", action: "Tắt đèn", status: "Thành công", time: "2026-01-25 10:14:55" },
    { id: 202, device: "Đèn led 2", action: "Bật đèn", status: "Thành công", time: "2026-01-25 10:12:30" },
    { id: 203, device: "Đèn led 1", action: "Bật đèn", status: "Thành công", time: "2026-01-25 10:10:15" },
    { id: 204, device: "Đèn led 2", action: "Tắt đèn", status: "Thành công", time: "2026-01-25 09:45:00" },
];

export const mockUserProfile = {
    fullName: "Vũ Quang Huy",
    studentId: "B23DCCN412",
    class: "D23CNPM03",
    email: "HuyVQ.B23CN412@stu.ptit.edu.vn",
    phone: "0826180405",
    github: "github.com/vuhuy1804",
    figma: "figma.com",
    baocao: "docs.google.com"
};