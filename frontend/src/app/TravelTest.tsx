"use client";

import { useState } from 'react';

const TENPING_LINK = "https://iryan.kr/t8gp1rpfmg";

type Question = {
  id: number;
  text: string;
  options: { text: string; value: string }[];
};

const questions: Question[] = [
  {
    id: 1,
    text: "이번 휴가, 당신이 가장 원하는 휴식의 형태는?",
    options: [
      { text: "아무것도 안 하고 푹 쉬고 싶어 (호캉스/풀빌라)", value: "REST" },
      { text: "여기저기 돌아다니며 새로운 경험을 원해 (관광/액티비티)", value: "ACTIVE" },
    ]
  },
  {
    id: 2,
    text: "누구와 함께 떠나시나요?",
    options: [
      { text: "혼자 또는 연인과 오붓하게", value: "COUPLE" },
      { text: "가족이나 친구들과 시끌벅적하게", value: "GROUP" },
    ]
  },
  {
    id: 3,
    text: "여행 예산은 어느 정도 생각하시나요?",
    options: [
      { text: "가성비 좋게 알뜰한 여행", value: "BUDGET" },
      { text: "돈 걱정 없이 플렉스!", value: "LUXURY" },
    ]
  }
];

export default function TravelTest() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);

  const handleOptionClick = (value: string) => {
    const newAnswers = [...answers, value];
    
    if (currentQuestionIndex < questions.length - 1) {
      setAnswers(newAnswers);
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setAnswers(newAnswers);
      setShowResult(true);
    }
  };

  const getResult = () => {
    const isRest = answers.includes("REST");
    const isActive = answers.includes("ACTIVE");
    const isLuxury = answers.includes("LUXURY");
    const isGroup = answers.includes("GROUP");

    if (isRest && isLuxury) return {
      title: "프리미엄 5성급 호캉스",
      desc: "당신에게는 모든 것이 완벽하게 갖춰진 5성급 호텔에서의 럭셔리한 휴식이 필요해요!",
      category: "국내 호텔 특가"
    };
    
    if (isRest && !isLuxury && isGroup) return {
      title: "감성 독채 펜션/풀빌라",
      desc: "일행끼리 프라이빗하게 물놀이도 하고 바베큐도 즐길 수 있는 펜션이 딱이네요!",
      category: "국내 펜션 특가"
    };

    if (isActive && isLuxury) return {
      title: "동남아 럭셔리 패키지",
      desc: "비행기 타고 훌쩍 떠나서 호핑투어와 마사지를 마음껏 즐기는 럭셔리 동남아 여행 추천!",
      category: "해외 패키지 특가"
    };

    return {
      title: "가성비 꿀잼 여행",
      desc: "합리적인 가격으로 알차게 돌아다닐 수 있는 가성비 최고 여행을 떠나보세요!",
      category: "국내 모텔 특가"
    };
  };

  const resetTest = () => {
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setShowResult(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-16">
      <div className="glass-card rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
        {/* Background Decorative Blob */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

        <h2 className="text-3xl font-extrabold mb-8 relative z-10">✨ 나만의 맞춤 여행지 테스트</h2>

        {!showResult ? (
          <div className="relative z-10">
            <div className="text-sm font-semibold text-accent mb-2">
              Question {currentQuestionIndex + 1} / {questions.length}
            </div>
            <h3 className="text-xl md:text-2xl font-bold mb-8 text-slate-800 dark:text-slate-100 min-h-[4rem]">
              {questions[currentQuestionIndex].text}
            </h3>
            
            <div className="flex flex-col gap-4">
              {questions[currentQuestionIndex].options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleOptionClick(opt.value)}
                  className="w-full py-4 px-6 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-accent hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all font-semibold text-lg text-slate-700 dark:text-slate-200 text-left"
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative z-10 animate-fade-in">
            <p className="text-lg font-semibold text-slate-500 mb-2">당신에게 딱 맞는 여행은...</p>
            <h3 className="text-3xl font-extrabold text-accent mb-4">
              {getResult().title}
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
              {getResult().desc}
            </p>
            
            <a
              href={TENPING_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg py-4 px-8 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
            >
              추천 특가 확인하러 가기 🚀
            </a>
            
            <button 
              onClick={resetTest}
              className="block w-full text-sm text-slate-400 mt-6 hover:text-slate-600 dark:hover:text-slate-300 underline"
            >
              테스트 다시 하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
