// ================================================================
// HORIKA Web - Film Grid & Filtering
// ================================================================

// Film data - will be loaded from JSON
let filmsData = [];
let currentFilter = 'all';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
	loadFilms();
	setupFilters();
	renderFilms();
});

/**
 * Load films from JSON data file
 */
async function loadFilms() {
	try {
		const response = await fetch('data/films.json');
		const data = await response.json();
		filmsData = data.films;
	} catch (error) {
		console.error('Error loading films:', error);
		// Fallback: render empty state
		renderFilms();
	}
}

/**
 * Setup filter button event listeners
 */
function setupFilters() {
	const filterButtons = document.querySelectorAll('.filter-btn');

	filterButtons.forEach(button => {
		button.addEventListener('click', (e) => {
			// Update active state
			filterButtons.forEach(btn => btn.classList.remove('active'));
			e.target.classList.add('active');

			// Update filter and re-render
			currentFilter = e.target.dataset.filter;
			renderFilms();
		});
	});
}

/**
 * Render film grid based on current filter
 */
function renderFilms() {
	const filmGrid = document.getElementById('filmGrid');

	if (!filmGrid) return;

	// Filter films
	const filteredFilms = currentFilter === 'all'
		? filmsData
		: filmsData.filter(film => film.type === currentFilter);

	// Generate HTML
	filmGrid.innerHTML = filteredFilms
		.map(film => createFilmCard(film))
		.join('');

	// Add click handlers for film cards
	setupFilmCards();
}

/**
 * Create a film card HTML element
 */
function createFilmCard(film) {
	return `
		<div class="film-card" data-film-id="${film.id}">
			<div class="film-wrapper" style="background-color: ${film.wrapperColor}"></div>
			<div class="film-name">${escapeHtml(film.name)}</div>
			<div class="film-type-badge ${film.type}">${getTypeName(film.type)}</div>
			<p class="film-description">${escapeHtml(film.description)}</p>
		</div>
	`;
}

/**
 * Setup click handlers for film cards (for future modal/detail view)
 */
function setupFilmCards() {
	const filmCards = document.querySelectorAll('.film-card');

	filmCards.forEach(card => {
		card.addEventListener('click', (e) => {
			const filmId = card.dataset.filmId;
			const film = filmsData.find(f => f.id === filmId);

			if (film) {
				// Future: Show film detail modal
				showFilmDetail(film);
			}
		});
	});
}

/**
 * Get human-friendly type name
 */
function getTypeName(type) {
	const names = {
		'normal': 'Normal',
		'pro': 'Pro',
		'rare': 'Rare',
		'seasonal': 'Seasonal'
	};
	return names[type] || type;
}

/**
 * Show film detail (currently just logs, can be expanded)
 */
function showFilmDetail(film) {
	// Future: Open a modal or detailed view
	console.log('Film clicked:', film);

	// For now, you could expand this to:
	// - Show a modal with full film description
	// - Display film characteristics
	// - Show sample images
	// - Allow sharing the film
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Smooth scroll to section
 */
function smoothScrollTo(selector) {
	const element = document.querySelector(selector);
	if (element) {
		element.scrollIntoView({ behavior: 'smooth' });
	}
}

// ================================================================
// ANIMATION & INTERACTION ENHANCEMENTS
// ================================================================

// Animate elements on scroll (optional, can be enhanced)
const observerOptions = {
	threshold: 0.1,
	rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
	entries.forEach(entry => {
		if (entry.isIntersecting) {
			entry.target.style.opacity = '1';
			entry.target.style.transform = 'translateY(0)';
		}
	});
}, observerOptions);

// Observe feature cards and film cards for animation
document.addEventListener('DOMContentLoaded', () => {
	const animateElements = document.querySelectorAll('.feature-card, .film-card');
	animateElements.forEach(el => {
		el.style.opacity = '0';
		el.style.transform = 'translateY(20px)';
		el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
		observer.observe(el);
	});
});

// ================================================================
// PAGE ANALYTICS & TRACKING (optional)
// ================================================================

// Log page view events for monitoring
if (window.location.hostname !== 'localhost') {
	// Add your analytics tracking here if needed
	// Example: sendAnalytics('page_view', { page: 'horika_landing' });
}
