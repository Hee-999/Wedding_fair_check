import HomeClient from './HomeClient';
import TravelTest from './TravelTest';

export const dynamic = 'force-dynamic'; // We can keep this or remove it, but Vercel will rebuild on git push anyway.

async function getLatestFairs() {
  try {
    // Import the statically generated JSON file directly. 
    // This ensures Vercel/Netlify perfectly bundles the data during build, regardless of file system restrictions.
    const fairData = (await import('../data/wedding_fairs.json')).default;
    return fairData;
  } catch (error) {
    console.error("Failed to load wedding fairs:", error);
    return null;
  }
}

export default async function Home() {
  const fairData = await getLatestFairs();

  return (
    <div className="w-full flex flex-col gap-12 pb-20 bg-[#faf8f5] min-h-screen">
      <section className="text-center pt-16 pb-10 bg-white shadow-sm border-b border-pink-50">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight text-slate-800">
          2026 <span className="text-pink-500">전국 웨딩 박람회</span> 일정
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto">
          매주 업데이트되는 지역별 웨딩 페어, 허니문, 혼수 박람회 일정을 한눈에 확인하고 무료 초대권을 신청하세요.
        </p>
      </section>

      <div className="px-4 md:px-8 max-w-7xl mx-auto w-full">
        {fairData ? (
          <HomeClient initialData={fairData} />
        ) : (
          <div className="glass-card p-12 text-center rounded-2xl bg-white">
            <p className="text-xl text-slate-500">아직 수집된 웨딩 박람회 일정이 없습니다.</p>
            <p className="mt-2 text-sm text-slate-400">크롤러를 먼저 실행해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
