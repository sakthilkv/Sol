import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type AppState = {
	dailyGoal: number;
	direction: 'en-ta' | 'ta-en';
	mode: 'choice' | 'typing';
	setDailyGoal: (goal: number) => void;
	setDirection: (direction: 'en-ta' | 'ta-en') => void;
	setMode: (mode: 'choice' | 'typing') => void;
};

export const useAppStore = create<AppState>()(
	persist(
		(set) => ({
			dailyGoal: 20,
			direction: 'en-ta',
			mode: 'choice',
			setDailyGoal: (dailyGoal) => set({ dailyGoal }),
			setDirection: (direction) => set({ direction }),
			setMode: (mode) => set({ mode }),
		}),
		{
			name: 'tamil-vocabulary-settings',
			storage: createJSONStorage(() => localStorage),
		},
	),
);
