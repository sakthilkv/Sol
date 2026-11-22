import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	Check,
	CheckCircle2,
	ChevronRight,
	CircleHelp,
	Flame,
	GraduationCap,
	Home,
	Keyboard,
	Languages,
	Library,
	RotateCcw,
	Search,
	Settings2,
	Sparkles,
	Target,
	TrendingUp,
	Upload,
	X,
	Zap,
} from 'lucide-react';
import { db, normalize, recordAnswer, seedIfEmpty, tamilVariants, todayKey, type Word } from './db';
import { useAppStore } from './store';

type Tab = 'home' | 'study' | 'library' | 'progress';
type Question = { word: Word; choices: string[] };

function shuffle<T>(items: T[]): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

function App() {
	const [tab, setTab] = useState<Tab>('home');
	const [words, setWords] = useState<Word[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [query, setQuery] = useState('');
	const [page, setPage] = useState(0);
	const [dailyDone, setDailyDone] = useState(0);
	const [todayCorrect, setTodayCorrect] = useState(0);
	const [todayAttempts, setTodayAttempts] = useState(0);
	const [streak, setStreak] = useState(0);
	const [quiz, setQuiz] = useState<Question[]>([]);
	const [questionIndex, setQuestionIndex] = useState(0);
	const [selected, setSelected] = useState('');
	const [typed, setTyped] = useState('');
	const [revealed, setRevealed] = useState(false);
	const [answered, setAnswered] = useState(false);
	const [sessionCorrect, setSessionCorrect] = useState(0);
	const [sessionTotal, setSessionTotal] = useState(0);
	const [sessionKind, setSessionKind] = useState<'daily' | 'review' | 'all'>('daily');
	const [showSettings, setShowSettings] = useState(false);
	const { dailyGoal, direction, mode, setDailyGoal, setDirection, setMode } = useAppStore();

	const refresh = useCallback(async () => {
		const all = await db.words.toArray();
		setWords(all);
		const today = todayKey();
		const logs = await db.sessions.where('date').equals(today).toArray();
		setDailyDone(new Set(logs.map((x) => x.wordId)).size);
		setTodayCorrect(logs.filter((x) => x.correct).length);
		setTodayAttempts(logs.length);
		const dates = [...new Set((await db.sessions.toArray()).map((x) => x.date))].sort().reverse();
		let count = 0;
		const d = new Date();
		for (const date of dates) {
			const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			if (date === key) {
				count++;
				d.setDate(d.getDate() - 1);
				while (
					dates.includes(
						`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
					)
				) {
					count++;
					d.setDate(d.getDate() - 1);
				}
				break;
			}
			if (date < key) break;
		}
		setStreak(count);
	}, []);

	useEffect(() => {
		(async () => {
			try {
				await seedIfEmpty();
				await refresh();
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Something went wrong loading your vocabulary.');
			} finally {
				setLoading(false);
			}
		})();
	}, [refresh]);

	const dueCount = useMemo(
		() => words.filter((w) => w.dueAt > 0 && w.dueAt <= Date.now()).length,
		[words],
	);
	const mastered = useMemo(() => words.filter((w) => w.repetitions >= 3).length, [words]);
	const newCount = useMemo(() => words.filter((w) => w.seen === 0).length, [words]);
	const accuracy = useMemo(() => {
		const attempts = words.reduce((n, w) => n + w.seen, 0);
		const correct = words.reduce((n, w) => n + w.correct, 0);
		return attempts ? Math.round((correct / attempts) * 100) : 0;
	}, [words]);

	const startQuiz = useCallback(
		async (kind: 'daily' | 'review' | 'all') => {
			const all = await db.words.toArray();
			const now = Date.now();
			const pool =
				kind === 'review'
					? all.filter((w) => w.dueAt > 0 && w.dueAt <= now)
					: kind === 'daily'
						? [
								...all.filter((w) => w.dueAt > 0 && w.dueAt <= now),
								...shuffle(all.filter((w) => w.seen === 0)).slice(
									0,
									Math.max(0, dailyGoal - dailyDone),
								),
							]
						: all;
			const unique = [...new Map(pool.map((w) => [w.id, w])).values()];
			const selectedWords = shuffle(unique).slice(
				0,
				kind === 'all' ? 25 : Math.max(1, kind === 'daily' ? dailyGoal : 20),
			);
			if (!selectedWords.length) {
				setError(
					kind === 'review'
						? "You're all caught up. No words are due for review."
						: 'No words available.',
				);
				return;
			}
			const questions = selectedWords.map((word) => {
				const correct = direction === 'en-ta' ? word.tamilword : word.engword;
				const candidates = all
					.filter((w) => w.id !== word.id)
					.map((w) => (direction === 'en-ta' ? w.tamilword : w.engword));
				return { word, choices: shuffle([correct, ...shuffle(candidates).slice(0, 3)]) };
			});
			setQuiz(questions);
			setQuestionIndex(0);
			setSelected('');
			setTyped('');
			setRevealed(false);
			setAnswered(false);
			setSessionCorrect(0);
			setSessionTotal(0);
			setSessionKind(kind);
			setTab('study');
			setError('');
		},
		[dailyGoal, dailyDone, direction],
	);

	const current = quiz[questionIndex];
	const prompt = current
		? direction === 'en-ta'
			? current.word.engword
			: current.word.tamilword
		: '';
	const answer = current
		? direction === 'en-ta'
			? current.word.tamilword
			: current.word.engword
		: '';
	const isCorrect =
		current &&
		(mode === 'typing'
			? direction === 'en-ta'
				? tamilVariants(current.word.tamilword).includes(normalize(typed))
				: normalize(typed) === normalize(answer)
			: selected === answer);

	async function submitAnswer() {
		if (!current || answered) return;
		const correct = Boolean(isCorrect);
		await recordAnswer(current.word, correct, direction);
		setAnswered(true);
		setRevealed(true);
		setSessionTotal((v) => v + 1);
		if (correct) setSessionCorrect((v) => v + 1);
		await refresh();
	}

	function nextQuestion() {
		if (questionIndex + 1 >= quiz.length) {
			setQuiz([]);
			setTab('home');
			refresh();
			return;
		}
		setQuestionIndex((v) => v + 1);
		setSelected('');
		setTyped('');
		setRevealed(false);
		setAnswered(false);
	}

	async function importFile(file?: File) {
		if (!file) return;
		try {
			const text = await file.text();
			const parsed = text
				.split(/\r?\n/)
				.filter(Boolean)
				.map((line) => JSON.parse(line));
			if (
				!parsed.length ||
				parsed.some((x) => typeof x.engword !== 'string' || typeof x.tamilword !== 'string')
			) {
				throw new Error('The file must contain JSONL rows with engword and tamilword fields.');
			}
			const existing = await db.words.toArray();
			const seenKeys = new Set(
				existing.map((w) => `${normalize(w.engword)}|${normalize(w.tamilword)}`),
			);
			const additions = parsed.filter(
				(x) => !seenKeys.has(`${normalize(x.engword)}|${normalize(x.tamilword)}`),
			);
			await db.words.bulkAdd(
				additions.map((x) => ({
					engword: x.engword.trim(),
					tamilword: x.tamilword.trim(),
					dueAt: 0,
					interval: 0,
					ease: 2.5,
					repetitions: 0,
					seen: 0,
					correct: 0,
				})) as Word[],
			);
			await refresh();
			setError(
				`Imported ${additions.length} new words. ${parsed.length - additions.length} duplicates skipped.`,
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Could not import this file.');
		}
	}

	const filteredWords = useMemo(
		() =>
			words.filter(
				(w) =>
					normalize(w.engword).includes(normalize(query)) ||
					normalize(w.tamilword).includes(normalize(query)),
			),
		[words, query],
	);
	const pageSize = 12;
	const pageCount = Math.max(1, Math.ceil(filteredWords.length / pageSize));
	const pageWords = filteredWords.slice(page * pageSize, (page + 1) * pageSize);

	if (loading)
		return (
			<div className="loading-screen">
				<div className="brand-mark">சொல்</div>
				<p>Preparing your vocabulary…</p>
			</div>
		);

	return (
		<div className="app-shell">
			<aside className="sidebar">
				<div className="brand">
					<div className="brand-mark">SOL</div>
					<div>
						<span>VOCABULARY TRAINER</span>
					</div>
				</div>
				<div className="side-label">LEARN</div>
				<nav>
					<button
						className={tab === 'home' ? 'nav-item active' : 'nav-item'}
						onClick={() => setTab('home')}
					>
						<Home size={18} /> Overview
					</button>
					<button
						className={tab === 'study' ? 'nav-item active' : 'nav-item'}
						onClick={() => startQuiz('daily')}
					>
						<GraduationCap size={18} /> Study session
					</button>
					<button
						className={tab === 'library' ? 'nav-item active' : 'nav-item'}
						onClick={() => setTab('library')}
					>
						<Library size={18} /> Word library
					</button>
					<button
						className={tab === 'progress' ? 'nav-item active' : 'nav-item'}
						onClick={() => setTab('progress')}
					>
						<TrendingUp size={18} /> Your progress
					</button>
				</nav>
				<div className="sidebar-bottom">
					<div className="daily-mini">
						<div className="mini-icon">
							<Flame size={17} />
						</div>
						<div>
							<b>{streak} day streak</b>
							<span>Keep the momentum going</span>
						</div>
					</div>
					<button className="nav-item" onClick={() => setShowSettings(true)}>
						<Settings2 size={18} /> Settings
					</button>
				</div>
			</aside>

			<main className="main-content">
				<header className="topbar">
					<div className="mobile-brand">
						<div className="brand-mark">சொல்</div>
						<strong>sol</strong>
					</div>
					<div className="breadcrumb">
						Your learning space <ChevronRight size={14} />{' '}
						<b>
							{tab === 'home'
								? 'Overview'
								: tab === 'study'
									? 'Study session'
									: tab === 'library'
										? 'Word library'
										: 'Your progress'}
						</b>
					</div>
					<button className="icon-button" title="Settings" onClick={() => setShowSettings(true)}>
						<Settings2 size={19} />
					</button>
				</header>

				{error && (
					<div className="notice">
						<CircleHelp size={17} />
						<span>{error}</span>
						<button onClick={() => setError('')}>
							<X size={16} />
						</button>
					</div>
				)}

				{tab === 'home' && (
					<section className="page">
						<div className="welcome-row">
							<div>
								<div className="eyebrow">
									<Sparkles size={14} /> YOUR DAILY PRACTICE
								</div>
								<h1>Build your Tamil vocabulary.</h1>
								<p className="muted">A little practice every day goes a long way.</p>
							</div>
							<div className="date-pill">
								{new Date().toLocaleDateString('en-IN', {
									weekday: 'long',
									day: 'numeric',
									month: 'long',
								})}
							</div>
						</div>
						<div className="hero-card">
							<div className="hero-copy">
								<div className="hero-tag">
									<Zap size={13} /> TODAY'S SESSION
								</div>
								<h2>
									Ready for your
									<br />
									<em>daily 20?</em>
								</h2>
								<p>Learn new words and revisit the ones that need a little more attention.</p>
								<button className="primary-button" onClick={() => startQuiz('daily')}>
									Start learning <ArrowRight size={17} />
								</button>
							</div>
							<div className="hero-visual">
								<div className="orbit orbit-one"></div>
								<div className="orbit orbit-two"></div>
								<div className="tamil-glyph">அ</div>
								<div className="floating-word word-one">
									அறிவு <span>Wisdom</span>
								</div>
								<div className="floating-word word-two">
									முயற்சி <span>Effort</span>
								</div>
								<div className="floating-word word-three">
									வெற்றி <span>Success</span>
								</div>
							</div>
						</div>
						<div className="section-heading">
							<div>
								<h3>Your learning at a glance</h3>
								<p className="muted">Small steps, consistent progress.</p>
							</div>
							<button className="text-button" onClick={() => setTab('progress')}>
								View progress <ArrowRight size={15} />
							</button>
						</div>
						<div className="stats-grid">
							<Stat
								icon={<BookOpen size={18} />}
								label="Total words"
								value={words.length.toLocaleString('en-IN')}
								note="In your vocabulary bank"
								tone="violet"
							/>
							<Stat
								icon={<Target size={18} />}
								label="Today's progress"
								value={`${Math.min(dailyDone, dailyGoal)} / ${dailyGoal}`}
								note={`${Math.max(0, dailyGoal - dailyDone)} to reach your goal`}
								tone="green"
							/>
							<Stat
								icon={<RotateCcw size={18} />}
								label="Due for review"
								value={dueCount.toLocaleString('en-IN')}
								note="Words ready to revisit"
								tone="orange"
							/>
							<Stat
								icon={<CheckCircle2 size={18} />}
								label="Mastered"
								value={mastered.toLocaleString('en-IN')}
								note="3+ successful review stages"
								tone="blue"
							/>
						</div>
						<div className="bottom-grid">
							<div className="panel goal-panel">
								<div className="panel-title">
									<div>
										<h3>Daily goal</h3>
										<p className="muted">Your consistency matters more than speed.</p>
									</div>
									<span className="goal-number">
										{Math.min(dailyDone, dailyGoal)}
										<small>/{dailyGoal}</small>
									</span>
								</div>
								<div className="progress-track">
									<div style={{ width: `${Math.min(100, (dailyDone / dailyGoal) * 100)}%` }} />
								</div>
								<div className="goal-foot">
									<span>
										{dailyDone >= dailyGoal
											? 'Daily goal completed. Excellent work!'
											: "You're making progress. Keep going!"}
									</span>
									<button onClick={() => setShowSettings(true)}>Adjust goal</button>
								</div>
							</div>
							<div className="panel review-panel">
								<div className="review-icon">
									<RotateCcw size={20} />
								</div>
								<div>
									<h3>Review queue</h3>
									<p className="muted">
										{dueCount
											? `${dueCount} words are waiting for review.`
											: "Nothing due right now. You're all caught up."}
									</p>
									<button
										className="text-button"
										onClick={() => startQuiz('review')}
										disabled={!dueCount}
									>
										Review words <ArrowRight size={15} />
									</button>
								</div>
							</div>
						</div>
					</section>
				)}

				{tab === 'study' && (
					<section className="page study-page">
						{!current ? (
							<div className="empty-state">
								<div className="empty-icon">
									<GraduationCap size={30} />
								</div>
								<h2>Ready when you are.</h2>
								<p>Start a short session and strengthen your recall.</p>
								<button className="primary-button" onClick={() => startQuiz('daily')}>
									Start daily session <ArrowRight size={17} />
								</button>
							</div>
						) : (
							<div className="quiz-wrap">
								<div className="quiz-top">
									<button
										className="back-button"
										onClick={() => {
											setQuiz([]);
											setTab('home');
										}}
									>
										<ArrowLeft size={17} /> Exit session
									</button>
									<span className="session-label">
										{sessionKind === 'review'
											? 'REVIEW SESSION'
											: sessionKind === 'all'
												? 'PRACTICE SESSION'
												: 'DAILY SESSION'}
									</span>
									<span className="question-count">
										{questionIndex + 1} <span>/ {quiz.length}</span>
									</span>
								</div>
								<div className="quiz-progress">
									<div
										style={{
											width: `${((questionIndex + (answered ? 1 : 0)) / quiz.length) * 100}%`,
										}}
									/>
								</div>
								<div className="question-card">
									<div className="question-meta">
										<span>{direction === 'en-ta' ? 'ENGLISH → TAMIL' : 'TAMIL → ENGLISH'}</span>
										<span>{mode === 'choice' ? 'CHOOSE THE MEANING' : 'TYPE THE MEANING'}</span>
									</div>
									<div className="question-prompt">{prompt}</div>
									<p className="question-hint">
										What is the correct {direction === 'en-ta' ? 'Tamil' : 'English'} meaning?
									</p>
									{mode === 'choice' ? (
										<div className="choices">
											{current.choices.map((choice, i) => {
												const correctChoice = choice === answer;
												const chosen = selected === choice;
												let cls = 'choice';
												if (answered && correctChoice) cls += ' correct';
												else if (answered && chosen && !correctChoice) cls += ' wrong';
												else if (chosen) cls += ' selected';
												return (
													<button
														key={`${choice}-${i}`}
														className={cls}
														disabled={answered}
														onClick={() => setSelected(choice)}
													>
														<span className="choice-letter">{String.fromCharCode(65 + i)}</span>
														<span>{choice}</span>
														{answered && correctChoice && <Check size={18} />}
													</button>
												);
											})}
										</div>
									) : (
										<div className="typing-wrap">
											<input
												autoFocus
												value={typed}
												disabled={answered}
												onChange={(e) => setTyped(e.target.value)}
												onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
												placeholder={
													direction === 'en-ta'
														? 'தமிழில் பதிலை எழுதுங்கள்…'
														: 'Type the English meaning…'
												}
											/>
											<Keyboard size={18} />
										</div>
									)}
									{answered && (
										<div className={isCorrect ? 'answer-feedback good' : 'answer-feedback bad'}>
											<div className="feedback-icon">
												{isCorrect ? <CheckCircle2 size={19} /> : <CircleHelp size={19} />}
											</div>
											<div>
												<b>{isCorrect ? 'Correct. Well done!' : 'Not quite. Keep practising.'}</b>
												<span>Answer: {answer}</span>
											</div>
										</div>
									)}
									<div className="question-actions">
										{!answered ? (
											<button
												className="primary-button submit-button"
												disabled={mode === 'choice' ? !selected : !typed.trim()}
												onClick={submitAnswer}
											>
												Check answer <Check size={17} />
											</button>
										) : (
											<button className="primary-button submit-button" onClick={nextQuestion}>
												{questionIndex + 1 === quiz.length ? 'Finish session' : 'Next question'}{' '}
												<ArrowRight size={17} />
											</button>
										)}
									</div>
								</div>
								<div className="quiz-footnote">
									<Sparkles size={14} /> Words you miss will come back sooner in future reviews.
								</div>
							</div>
						)}
					</section>
				)}

				{tab === 'library' && (
					<section className="page">
						<div className="page-heading">
							<div>
								<div className="eyebrow">
									<Library size={14} /> YOUR WORD BANK
								</div>
								<h1>Word library</h1>
								<p className="muted">
									Explore all {words.length.toLocaleString('en-IN')} English–Tamil pairs.
								</p>
							</div>
							<label className="secondary-button upload-button">
								<Upload size={16} /> Import JSONL
								<input
									type="file"
									accept=".jsonl,.json,.txt"
									onChange={(e) => importFile(e.target.files?.[0])}
								/>
							</label>
						</div>
						<div className="library-tools">
							<div className="search-box">
								<Search size={17} />
								<input
									value={query}
									onChange={(e) => {
										setQuery(e.target.value);
										setPage(0);
									}}
									placeholder="Search English or Tamil…"
								/>
							</div>
							<span>{filteredWords.length.toLocaleString('en-IN')} words</span>
						</div>
						<div className="word-table">
							<div className="table-head">
								<span>ENGLISH</span>
								<span>TAMIL</span>
								<span>STATUS</span>
							</div>
							{pageWords.map((w) => (
								<div className="word-row" key={w.id}>
									<span className="english-word">{w.engword}</span>
									<span className="tamil-word">{w.tamilword}</span>
									<span>
										{w.seen === 0 ? (
											<i className="status new">New</i>
										) : w.repetitions >= 3 ? (
											<i className="status mastered">Mastered</i>
										) : (
											<i className="status learning">Learning</i>
										)}
									</span>
								</div>
							))}
							{!pageWords.length && <div className="no-results">No matching words found.</div>}
						</div>
						<div className="pagination">
							<span>
								Page {page + 1} of {pageCount}
							</span>
							<div>
								<button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
									<ArrowLeft size={16} />
								</button>
								<button disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
									<ArrowRight size={16} />
								</button>
							</div>
						</div>
					</section>
				)}

				{tab === 'progress' && (
					<section className="page">
						<div className="page-heading">
							<div>
								<div className="eyebrow">
									<TrendingUp size={14} /> YOUR JOURNEY
								</div>
								<h1>Progress & consistency</h1>
								<p className="muted">Every word you practise brings you closer to mastery.</p>
							</div>
						</div>
						<div className="stats-grid progress-stats">
							<Stat
								icon={<BookOpen size={18} />}
								label="Words studied"
								value={words.filter((w) => w.seen > 0).length.toLocaleString('en-IN')}
								note={`Of ${words.length.toLocaleString('en-IN')} total words`}
								tone="violet"
							/>
							<Stat
								icon={<CheckCircle2 size={18} />}
								label="Accuracy"
								value={`${accuracy}%`}
								note="Across all attempts"
								tone="green"
							/>
							<Stat
								icon={<Flame size={18} />}
								label="Current streak"
								value={`${streak} days`}
								note="Consecutive study days"
								tone="orange"
							/>
							<Stat
								icon={<GraduationCap size={18} />}
								label="Mastered words"
								value={mastered.toLocaleString('en-IN')}
								note="3+ successful review stages"
								tone="blue"
							/>
						</div>
						<div className="panel progress-panel">
							<div>
								<h3>Learning breakdown</h3>
								<p className="muted">How your vocabulary bank is progressing.</p>
							</div>
							<div className="breakdown">
								<ProgressLine label="New" count={newCount} total={words.length} color="purple" />
								<ProgressLine
									label="Learning"
									count={words.filter((w) => w.seen > 0 && w.repetitions < 3).length}
									total={words.length}
									color="orange"
								/>
								<ProgressLine
									label="Mastered"
									count={mastered}
									total={words.length}
									color="green"
								/>
							</div>
						</div>
						<div className="panel history-panel">
							<h3>Study summary</h3>
							<div className="history-grid">
								<div>
									<span>Today's attempts</span>
									<b>{todayAttempts}</b>
								</div>
								<div>
									<span>Correct answers today</span>
									<b>{todayCorrect}</b>
								</div>
								<div>
									<span>Review queue</span>
									<b>{dueCount}</b>
								</div>
							</div>
						</div>
					</section>
				)}
			</main>

			{showSettings && (
				<div className="modal-backdrop" onClick={() => setShowSettings(false)}>
					<div className="settings-modal" onClick={(e) => e.stopPropagation()}>
						<div className="modal-head">
							<div>
								<div className="eyebrow">
									<Settings2 size={14} /> PREFERENCES
								</div>
								<h2>Study settings</h2>
							</div>
							<button className="icon-button" onClick={() => setShowSettings(false)}>
								<X size={19} />
							</button>
						</div>
						<div className="setting-group">
							<label>Daily new-word goal</label>
							<div className="goal-options">
								{[10, 20, 30, 40].map((n) => (
									<button
										key={n}
										className={dailyGoal === n ? 'goal-option chosen' : 'goal-option'}
										onClick={() => setDailyGoal(n)}
									>
										{n}
									</button>
								))}
							</div>
						</div>
						<div className="setting-group">
							<label>Quiz direction</label>
							<div className="setting-options">
								<button
									className={direction === 'en-ta' ? 'setting-option chosen' : 'setting-option'}
									onClick={() => setDirection('en-ta')}
								>
									<Languages size={17} /> English → Tamil
								</button>
								<button
									className={direction === 'ta-en' ? 'setting-option chosen' : 'setting-option'}
									onClick={() => setDirection('ta-en')}
								>
									<Languages size={17} /> Tamil → English
								</button>
							</div>
						</div>
						<div className="setting-group">
							<label>Answer style</label>
							<div className="setting-options">
								<button
									className={mode === 'choice' ? 'setting-option chosen' : 'setting-option'}
									onClick={() => setMode('choice')}
								>
									<CheckCircle2 size={17} /> Multiple choice
								</button>
								<button
									className={mode === 'typing' ? 'setting-option chosen' : 'setting-option'}
									onClick={() => setMode('typing')}
								>
									<Keyboard size={17} /> Type answer
								</button>
							</div>
						</div>
						<div className="modal-foot">
							<span>Your progress is saved on this device.</span>
							<button className="primary-button" onClick={() => setShowSettings(false)}>
								Done <Check size={16} />
							</button>
						</div>
					</div>
				</div>
			)}
			<nav className="mobile-nav">
				<button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
					<Home size={19} />
					<span>Home</span>
				</button>
				<button className={tab === 'study' ? 'active' : ''} onClick={() => startQuiz('daily')}>
					<GraduationCap size={19} />
					<span>Study</span>
				</button>
				<button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>
					<Library size={19} />
					<span>Library</span>
				</button>
				<button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>
					<TrendingUp size={19} />
					<span>Progress</span>
				</button>
			</nav>
		</div>
	);
}

function awaitlessNumber(n: number) {
	return n;
}

function Stat({
	icon,
	label,
	value,
	note,
	tone,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	note: string;
	tone: string;
}) {
	return (
		<div className="stat-card">
			<div className={`stat-icon ${tone}`}>{icon}</div>
			<span className="stat-label">{label}</span>
			<strong>{value}</strong>
			<small>{note}</small>
		</div>
	);
}

function ProgressLine({
	label,
	count,
	total,
	color,
}: {
	label: string;
	count: number;
	total: number;
	color: string;
}) {
	return (
		<div className="progress-line">
			<div className="line-label">
				<span>{label}</span>
				<b>
					{count.toLocaleString('en-IN')}{' '}
					<small>({total ? Math.round((count / total) * 100) : 0}%)</small>
				</b>
			</div>
			<div className="progress-track">
				<div className={color} style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
			</div>
		</div>
	);
}

export default App;
