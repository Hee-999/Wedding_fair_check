"use client";

import { useState, useMemo } from 'react';

type FairItem = {
  region: string;
  title: string;
  date: string;
  location: string;
  link: string;
  imageUrl: string | null;
};

type FairsData = Record<string, FairItem[]>;

export default function HomeClient({ initialData }: { initialData: FairsData }) {
  // Extract categories dynamically from the data, keeping "전체" first
  const categories = useMemo(() => {
    const keys = Object.keys(initialData);
    const sorted = keys.filter(k => k !== '전체').sort();
    return ['전체', ...sorted];
  }, [initialData]);

  const [activeTab, setActiveTab] = useState(categories[0] || '전체');

  // Get items for the currently active tab
  const currentItems = initialData[activeTab] || [];

  return (
    <div className="flex flex-col md:flex-row w-full gap-8">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-48 shrink-0">
        <div className="sticky top-24 bg-white rounded-2xl p-4 flex flex-col gap-2 shadow-sm border border-slate-100">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">지역 선택</h2>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`flex items-center text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === cat
                  ? 'text-pink-600 bg-pink-50 font-extrabold shadow-sm border-l-4 border-pink-500'
                  : 'text-slate-600 hover:bg-slate-50 font-medium'
              }`}
            >
              {cat === '전체' ? '🌐 전체 보기' : `📍 ${cat}`}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-0">
        <h2 className="text-2xl font-extrabold mb-6 text-slate-800 hidden md:block">
          {activeTab === '전체' ? '전국 박람회 일정' : `${activeTab} 박람회 일정`}
        </h2>
        
        {/* Grid of Fair Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentItems.map((item, idx) => (
            <div
              key={idx}
              className="bg-white group flex flex-col rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300"
            >
              {/* Image Section */}
              <div className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 bg-pink-50">
                    <span className="text-4xl opacity-20">💍</span>
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm text-pink-600 font-bold px-3 py-1 rounded-full text-xs shadow-sm border border-pink-100">
                  {item.region}
                </div>
              </div>

              {/* Content Section */}
              <div className="p-5 flex flex-col flex-1">
                <h3 className="text-lg font-bold text-slate-900 line-clamp-2 mb-3 group-hover:text-pink-600 transition-colors">
                  {item.title}
                </h3>
                
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex items-start text-sm text-slate-600">
                    <span className="mr-2">🗓️</span>
                    <span className="font-medium text-slate-700">{item.date}</span>
                  </div>
                  <div className="flex items-start text-sm text-slate-500">
                    <span className="mr-2 mt-0.5">📍</span>
                    <span className="line-clamp-2 leading-snug">{item.location}</span>
                  </div>
                </div>
                
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center bg-pink-50 hover:bg-pink-500 hover:text-white text-pink-600 font-bold py-3 px-4 rounded-xl transition-colors duration-200"
                  >
                    무료 초대권 신청하기
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {currentItems.length === 0 && (
          <div className="py-20 text-center text-slate-500 bg-white rounded-2xl border border-slate-100">
            해당 지역의 박람회 일정이 아직 없습니다. 😢
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] overflow-x-auto hide-scrollbar py-3 px-4">
        <div className="flex gap-2 min-w-max">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveTab(cat);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs transition-all duration-200 ${
                activeTab === cat
                  ? 'bg-pink-500 text-white border-pink-500 font-bold shadow-md shadow-pink-100 scale-105'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 font-medium'
              }`}
            >
              <span className="text-sm">{cat === '전체' ? '🌐' : '📍'}</span>
              <span className="whitespace-nowrap">{cat}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
