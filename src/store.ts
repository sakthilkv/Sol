import { create } from "zustand";

type AppState = {
  dailyGoal: number;
  direction: "en-ta" | "ta-en";
  mode: "choice" | "typing";
  setDailyGoal: (goal: number) => void;
  setDirection: (direction: "en-ta" | "ta-en") => void;
  setMode: (mode: "choice" | "typing") => void;
};

export const useAppStore = create<AppState>((set) => ({
  dailyGoal: 20,
  direction: "en-ta",
  mode: "choice",
  setDailyGoal: (dailyGoal) => set({ dailyGoal }),
  setDirection: (direction) => set({ direction }),
  setMode: (mode) => set({ mode })
}));