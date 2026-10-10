import React from 'react';

export default function Header({ activeTab, setActiveTab }) {
    const tabs = [
        { id: 'dashboard', label: 'Trang chủ' },
        { id: 'sensor-history', label: 'Lịch sử cảm biến' },
        { id: 'action-history', label: 'Lịch sử hoạt động' },
        { id: 'profile', label: 'Cá nhân' },
    ];

    return (
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 py-3 mb-6 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 flex justify-center items-center">
                <nav className="flex space-x-2 bg-gray-100/80 p-1.5 rounded-full">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-2 text-sm font-medium rounded-full transition-all duration-200 ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
        </header>
    );
}