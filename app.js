// ========== CONSTANTS ==========
const QUIZ_CONFIG = {
    DEFAULT_QUESTIONS: 10,
    MAX_QUESTIONS: 20,
    MIN_QUESTIONS: 5,
    TIME_PER_QUESTION: 15
};

const CATEGORIES = [
    { id: 'javascript', name: 'JavaScript', icon: '⚡' },
    { id: 'python', name: 'Python', icon: '🐍' },
    { id: 'react', name: 'React', icon: '⚛️' },
    { id: 'html', name: 'HTML/CSS', icon: '🎨' },
    { id: 'general', name: 'General Knowledge', icon: '🌐' }
];

const DIFFICULTIES = [
    { id: 'easy', name: 'Easy', color: '#10b981' },
    { id: 'medium', name: 'Medium', color: '#f59e0b' },
    { id: 'hard', name: 'Hard', color: '#ef4444' }
];

const THEMES = ['light', 'dark', 'neon'];

const STORAGE_KEYS = {
    THEME: 'quiz_theme',
    HIGH_SCORE: 'quiz_high_score',
    LEADERBOARD: 'quiz_leaderboard'
};

// ========== THEME MANAGER ==========
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
        this.applyTheme(this.currentTheme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEYS.THEME, theme);
        this.currentTheme = theme;
        
        // Dispatch event for components to react
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    getThemes() {
        return THEMES;
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    toggleTheme() {
        const themes = this.getThemes();
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.applyTheme(themes[nextIndex]);
    }
}

// ========== STORAGE MANAGER ==========
class StorageManager {
    saveHighScore(score) {
        const currentHigh = this.getHighScore();
        if (score > currentHigh) {
            localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, score.toString());
            return true; // New high score
        }
        return false;
    }

    getHighScore() {
        return parseInt(localStorage.getItem(STORAGE_KEYS.HIGH_SCORE)) || 0;
    }

    saveToLeaderboard(entry) {
        const leaderboard = this.getLeaderboard();
        leaderboard.push({
            ...entry,
            date: new Date().toISOString()
        });
        
        // Sort by score descending and keep top 10
        leaderboard.sort((a, b) => b.score - a.score);
        const trimmed = leaderboard.slice(0, 10);
        
        localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(trimmed));
    }

    getLeaderboard() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADERBOARD)) || [];
    }

    clearLeaderboard() {
        localStorage.removeItem(STORAGE_KEYS.LEADERBOARD);
    }
}

// ========== TOAST MANAGER ==========
class ToastManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
        this.toasts = new Set();
    }

    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-message">${message}</span>
            </div>
        `;

        this.container.appendChild(toast);
        this.toasts.add(toast);

        // Auto remove after duration
        setTimeout(() => {
            this.remove(toast);
        }, duration);

        // Click to dismiss
        toast.addEventListener('click', () => this.remove(toast));
    }

    remove(toast) {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            toast.remove();
            this.toasts.delete(toast);
        }, 300);
    }

    success(message) {
        this.show(message, 'success');
    }

    error(message) {
        this.show(message, 'error');
    }

    info(message) {
        this.show(message, 'info');
    }

    warning(message) {
        this.show(message, 'warning');
    }
}

// ========== API SERVICE ==========
const API_BASE = 'https://opentdb.com/api.php';

async function fetchQuestions(category = 'javascript', difficulty = 'medium', amount = 10) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        // Map our categories to OpenTDB category IDs
        const categoryMap = {
            'javascript': 18,
            'python': 18,
            'react': 18,
            'html': 18,
            'general': 9
        };

        const url = new URL(API_BASE);
        url.searchParams.append('amount', amount);
        url.searchParams.append('category', categoryMap[category] || 9);
        url.searchParams.append('difficulty', difficulty);
        url.searchParams.append('type', 'multiple');
        url.searchParams.append('encode', 'base64');

        const response = await fetch(url, { signal: controller.signal });
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.response_code !== 0) {
            throw new Error('Failed to fetch questions');
        }

        // Decode and format questions
        const questions = data.results.map(q => ({
            question: atob(q.question),
            options: shuffleOptions([
                atob(q.correct_answer),
                ...q.incorrect_answers.map(a => atob(a))
            ]),
            correct: atob(q.correct_answer),
            category: atob(q.category),
            difficulty: q.difficulty
        }));

        return questions;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - please try again');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function shuffleOptions(options) {
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
}

function getFallbackQuestions(category, difficulty, amount = 10) {
    const fallbacks = [
        {
            question: "What is JavaScript?",
            options: ["A programming language", "A coffee brand", "A movie", "A car model"],
            correct: "A programming language",
            category: "JavaScript"
        },
        {
            question: "What is React?",
            options: ["A UI library", "A framework", "A language", "A database"],
            correct: "A UI library",
            category: "JavaScript"
        },
        {
            question: "What does CSS stand for?",
            options: [
                "Cascading Style Sheets",
                "Computer Style System",
                "Creative Style Syntax",
                "Colorful Style Sheets"
            ],
            correct: "Cascading Style Sheets",
            category: "HTML/CSS"
        },
        {
            question: "What is Python?",
            options: [
                "A programming language",
                "A snake",
                "A movie",
                "A framework"
            ],
            correct: "A programming language",
            category: "Python"
        }
    ];
    
    // Repeat fallbacks to reach desired amount
    const questions = [];
    for (let i = 0; i < amount; i++) {
        questions.push({
            ...fallbacks[i % fallbacks.length],
            difficulty: difficulty
        });
    }
    
    return questions;
}

// ========== TIMER COMPONENT ==========
class Timer {
    constructor(elementId, initialTime, onComplete) {
        this.element = document.getElementById(elementId);
        this.initialTime = initialTime;
        this.timeLeft = initialTime;
        this.onComplete = onComplete;
        this.interval = null;
        this.start();
    }

    start() {
        this.interval = setInterval(() => {
            this.timeLeft--;
            this.update();
            
            if (this.timeLeft <= 0) {
                this.stop();
                if (this.onComplete) this.onComplete();
            }
        }, 1000);
    }

    update() {
        if (this.element) {
            this.element.textContent = `${this.timeLeft}s`;
            
            if (this.timeLeft <= 5) {
                this.element.classList.add('warning');
            } else {
                this.element.classList.remove('warning');
            }
        }
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    reset() {
        this.stop();
        this.timeLeft = this.initialTime;
        this.update();
        this.start();
    }
}

// ========== PROGRESS BAR COMPONENT ==========
class ProgressBar {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    update(percentage) {
        if (this.container) {
            const fill = this.container.querySelector('.progress-fill');
            if (fill) {
                fill.style.width = `${percentage}%`;
            }
        }
    }
}

// ========== QUIZ CARD COMPONENT ==========
class QuizCard {
    constructor(questions) {
        this.questions = questions;
        this.currentIndex = 0;
        this.score = 0;
        this.userAnswers = [];
        this.timer = null;
        this.progressBar = null;
        
        this.element = this.createElement();
        this.render();
    }

    createElement() {
        const card = document.createElement('div');
        card.className = 'quiz-card';
        card.id = 'quizCard';
        return card;
    }

    render() {
        const question = this.questions[this.currentIndex];
        const progress = (this.currentIndex / this.questions.length) * 100;

        this.element.innerHTML = `
            <div class="quiz-header">
                <div class="question-counter">
                    Question ${this.currentIndex + 1}/${this.questions.length}
                </div>
                <div class="score-display">
                    Score: ${this.score}
                </div>
            </div>
            
            <div id="progressContainer" class="progress-container">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            
            <div class="timer" id="timer">${QUIZ_CONFIG.TIME_PER_QUESTION}s</div>
            
            <h2 class="question-text neon-text">${question.question}</h2>
            
            <div class="options-grid" id="optionsGrid">
                ${question.options.map(opt => `
                    <button class="option-btn">${opt}</button>
                `).join('')}
            </div>
            
            <div class="quiz-footer">
                <button class="btn" id="nextBtn" ${this.userAnswers[this.currentIndex] ? '' : 'disabled'}>
                    Next Question →
                </button>
            </div>
        `;

        this.progressBar = new ProgressBar('progressContainer');
        this.attachEvents();
        this.startTimer();
    }

    attachEvents() {
        const options = this.element.querySelectorAll('.option-btn');
        options.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleOptionSelect(e));
        });

        const nextBtn = this.element.querySelector('#nextBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.handleNext());
        }
    }

    handleOptionSelect(e) {
        if (this.userAnswers[this.currentIndex]) return;

        const selected = e.target;
        const options = this.element.querySelectorAll('.option-btn');
        const question = this.questions[this.currentIndex];
        
        options.forEach(opt => opt.classList.remove('selected'));
        selected.classList.add('selected');
        
        const isCorrect = selected.textContent === question.correct;
        this.userAnswers[this.currentIndex] = {
            selected: selected.textContent,
            correct: isCorrect
        };

        if (isCorrect) {
            this.score++;
            toast.success('✅ Correct!');
        } else {
            toast.error('❌ Wrong answer');
        }

        options.forEach(opt => opt.disabled = true);
        
        const nextBtn = this.element.querySelector('#nextBtn');
        if (nextBtn) nextBtn.disabled = false;
        
        if (this.timer) {
            this.timer.stop();
        }
    }

    handleNext() {
        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            this.render();
        } else {
            this.finishQuiz();
        }
    }

    startTimer() {
        this.timer = new Timer('timer', QUIZ_CONFIG.TIME_PER_QUESTION, () => {
            if (!this.userAnswers[this.currentIndex]) {
                this.userAnswers[this.currentIndex] = {
                    selected: null,
                    correct: false
                };
                
                const options = this.element.querySelectorAll('.option-btn');
                options.forEach(opt => opt.disabled = true);
                
                const nextBtn = this.element.querySelector('#nextBtn');
                if (nextBtn) nextBtn.disabled = false;
                
                toast.error('⏰ Time\'s up!');
            }
        });
    }

    finishQuiz() {
        const isHighScore = storage.saveHighScore(this.score);
        
        if (isHighScore) {
            toast.success('🎉 New High Score!');
        }

        storage.saveToLeaderboard({
            score: this.score,
            total: this.questions.length,
            category: this.questions[0].category
        });

        window.dispatchEvent(new CustomEvent('quizComplete', {
            detail: {
                score: this.score,
                total: this.questions.length,
                questions: this.questions,
                answers: this.userAnswers
            }
        }));
    }

    getElement() {
        return this.element;
    }
}

// ========== MAIN APP CLASS ==========
class QuizApp {
    constructor() {
        this.currentScreen = 'setup';
        this.questions = [];
        this.quizCard = null;
        
        this.init();
    }

    async init() {
        this.renderSetupScreen();
        this.attachGlobalEvents();
        this.loadHighScore();
    }

    renderSetupScreen() {
        const app = document.getElementById('app');
        
        app.innerHTML = `
            <div class="quiz-card">
                <div class="setup-header">
                    <h1 class="neon-text">⚡ NeonQuiz</h1>
                    <div class="theme-toggle" id="themeToggle">
                        ${themeManager.getThemes().map(theme => `
                            <button class="theme-option ${theme === themeManager.getCurrentTheme() ? 'active' : ''}" 
                                    data-theme="${theme}">
                                ${theme.charAt(0).toUpperCase() + theme.slice(1)}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="high-score">
                    <span class="high-score-label">🏆 High Score</span>
                    <span class="high-score-value" id="highScore">${storage.getHighScore()}</span>
                </div>

                <div class="setup-form">
                    <div class="form-group">
                        <label>Category</label>
                        <select id="category" class="select-control">
                            ${CATEGORIES.map(cat => `
                                <option value="${cat.id}">${cat.icon} ${cat.name}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Difficulty</label>
                        <select id="difficulty" class="select-control">
                            ${DIFFICULTIES.map(diff => `
                                <option value="${diff.id}">${diff.name}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Questions</label>
                        <input type="number" id="amount" class="select-control" 
                               min="5" max="20" value="10">
                    </div>

                    <button class="btn btn-primary" id="startQuiz">
                        <span class="btn-text">Start Quiz</span>
                        <span class="btn-icon">→</span>
                    </button>
                </div>

                <div class="leaderboard-preview">
                    <h3>🏆 Leaderboard</h3>
                    <div id="leaderboardList">
                        ${this.renderLeaderboard()}
                    </div>
                </div>
            </div>
        `;

        this.attachSetupEvents();
    }

    renderLeaderboard() {
        const leaderboard = storage.getLeaderboard();
        
        if (leaderboard.length === 0) {
            return '<p class="no-scores">No scores yet. Be the first!</p>';
        }

        return leaderboard.map((entry, index) => `
            <div class="leaderboard-item ${index === 0 ? 'gold' : ''}">
                <span class="rank">#${index + 1}</span>
                <span class="score">${entry.score}</span>
                <span class="date">${new Date(entry.date).toLocaleDateString()}</span>
            </div>
        `).join('');
    }

    attachSetupEvents() {
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.target.dataset.theme;
                themeManager.applyTheme(theme);
                
                document.querySelectorAll('.theme-option').forEach(b => 
                    b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        document.getElementById('startQuiz').addEventListener('click', async () => {
            await this.startQuiz();
        });
    }

    async startQuiz() {
        const category = document.getElementById('category').value;
        const difficulty = document.getElementById('difficulty').value;
        const amount = document.getElementById('amount').value;

        const app = document.getElementById('app');
        
        app.innerHTML = `
            <div class="quiz-card loading">
                <div class="spinner"></div>
                <h3 class="neon-text">Generating your quiz...</h3>
                <p>Fetching questions from the universe</p>
            </div>
        `;

        try {
            this.questions = await fetchQuestions(category, difficulty, amount);
            
            if (!this.questions || this.questions.length === 0) {
                throw new Error('No questions received');
            }

            this.quizCard = new QuizCard(this.questions);
            app.innerHTML = '';
            app.appendChild(this.quizCard.getElement());
            
            toast.success('🎯 Quiz loaded! Good luck!');
        } catch (error) {
            console.error('Failed to fetch questions:', error);
            
            this.questions = getFallbackQuestions(category, difficulty, amount);
            this.quizCard = new QuizCard(this.questions);
            
            app.innerHTML = '';
            app.appendChild(this.quizCard.getElement());
            
            toast.warning('Using offline questions. API unavailable.');
        }
    }

    attachGlobalEvents() {
        window.addEventListener('quizComplete', (e) => {
            this.showResults(e.detail);
        });

        window.addEventListener('themechange', () => {
            this.loadHighScore();
        });
    }

    showResults({ score, total, questions, answers }) {
        const app = document.getElementById('app');
        
        const percentage = (score / total) * 100;
        const isHighScore = storage.saveHighScore(score);

        app.innerHTML = `
            <div class="quiz-card score-card">
                <h1 class="neon-text">Quiz Complete! 🎉</h1>
                
                <div class="score-circle">
                    ${score}/${total}
                </div>
                
                <div class="score-stats">
                    <div class="stat">
                        <span class="stat-label">Accuracy</span>
                        <span class="stat-value">${percentage.toFixed(1)}%</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Correct</span>
                        <span class="stat-value">${score}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Incorrect</span>
                        <span class="stat-value">${total - score}</span>
                    </div>
                </div>

                ${isHighScore ? '<div class="new-record">🏆 NEW RECORD! 🏆</div>' : ''}

                <div class="review-section">
                    <h3>Review Answers</h3>
                    <div class="review-list">
                        ${questions.map((q, i) => `
                            <div class="review-item ${answers[i]?.correct ? 'correct' : 'wrong'}">
                                <div class="review-question">${q.question}</div>
                                <div class="review-answer">
                                    Your answer: ${answers[i]?.selected || 'No answer'}
                                    ${!answers[i]?.correct ? `<br>Correct: ${q.correct}` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="btn" id="playAgain">
                        <span class="btn-text">Play Again</span>
                        <span class="btn-icon">↻</span>
                    </button>
                    <button class="btn" id="viewLeaderboard">
                        <span class="btn-text">Leaderboard</span>
                        <span class="btn-icon">🏆</span>
                    </button>
                </div>
            </div>
        `;

        document.getElementById('playAgain').addEventListener('click', () => {
            this.renderSetupScreen();
        });

        document.getElementById('viewLeaderboard').addEventListener('click', () => {
            this.renderSetupScreen();
        });
    }

    loadHighScore() {
        const highScoreEl = document.getElementById('highScore');
        if (highScoreEl) {
            highScoreEl.textContent = storage.getHighScore();
        }
    }
}

// ========== INITIALIZATION ==========
const themeManager = new ThemeManager();
const storage = new StorageManager();
const toast = new ToastManager();

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new QuizApp();
});