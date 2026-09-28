const NEWS_URL = 'https://litestar.pages.dev/api/news.json';

const newsList = document.querySelector('#news-list');
const feedCount = document.querySelector('#feed-count');
const searchInput = document.querySelector('#news-search');
const sortSelect = document.querySelector('#news-sort');
const refreshButton = document.querySelector('#refresh-news');

let articles = [];

function formatDate(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value || '날짜 미정';
	return new Intl.DateTimeFormat('ko-KR', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	}).format(date);
}

function getPlainText(content) {
	return content
		.replace(/<part='([^']*)'>/g, '$1\n')
		.replace(/<\/?(?:part|li|bold)(?:\s+[^>]*)?>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function appendTextWithBreaks(parent, text) {
	const lines = text.split('\n');
	lines.forEach((line, index) => {
		if (line) parent.append(document.createTextNode(line));
		if (index < lines.length - 1) parent.append(document.createElement('br'));
	});
}

function renderArticleContent(container, content) {
	const tokens = content.split(/(<part='[^']*'>|<\/part>|<li>|<\/li>|<bold>|<\/bold>)/g);
	let currentParent = container;
	let currentSection = null;
	let currentList = null;
	let currentItem = null;
	let currentStrong = null;

	tokens.forEach((token) => {
		if (!token) return;
		const partMatch = token.match(/^<part='([^']*)'>$/);
		if (partMatch) {
			currentSection = document.createElement('section');
			const heading = document.createElement('h3');
			heading.textContent = partMatch[1];
			currentSection.append(heading);
			container.append(currentSection);
			currentParent = currentSection;
			currentList = null;
			currentItem = null;
			return;
		}
		if (token === '</part>') {
			currentParent = container;
			currentSection = null;
			currentList = null;
			currentItem = null;
			currentStrong = null;
			return;
		}
		if (token === '<li>') {
			if (!currentList) {
				currentList = document.createElement('ul');
				currentParent.append(currentList);
			}
			currentItem = document.createElement('li');
			currentList.append(currentItem);
			currentParent = currentItem;
			return;
		}
		if (token === '</li>') {
			currentParent = currentList || currentSection || container;
			currentItem = null;
			return;
		}
		if (token === '<bold>') {
			currentStrong = document.createElement('strong');
			currentParent.append(currentStrong);
			currentParent = currentStrong;
			return;
		}
		if (token === '</bold>') {
			currentParent = currentItem || currentSection || container;
			currentStrong = null;
			return;
		}
		appendTextWithBreaks(currentParent, token);
	});
}

function showEmptyState(title, message) {
	const state = document.createElement('div');
	state.className = 'empty-state';
	const heading = document.createElement('strong');
	heading.textContent = title;
	const detail = document.createElement('span');
	detail.textContent = message;
	state.append(heading, detail);
	newsList.replaceChildren(state);
}

function renderNews() {
	const query = searchInput.value.trim().toLocaleLowerCase('ko');
	const sorted = [...articles].sort((left, right) => {
		const difference = new Date(right.d).getTime() - new Date(left.d).getTime();
		return sortSelect.value === 'newest' ? difference : -difference;
	});
	const filtered = sorted.filter((article) => {
		const searchable = `${article.title} ${article.content} ${article.source}`.toLocaleLowerCase('ko');
		return searchable.includes(query);
	});

	feedCount.textContent = `${articles.length}개의 소식`;
	if (filtered.length === 0) {
		showEmptyState(query ? '검색 결과가 없어요' : '아직 등록된 뉴스가 없어요', query ? '다른 검색어로 다시 찾아보세요.' : '새로운 소식이 올라오면 이곳에 표시됩니다.');
		return;
	}

	const fragment = document.createDocumentFragment();
	filtered.forEach((article, index) => {
		const card = document.createElement('article');
		card.className = 'news-card';
		card.style.animationDelay = `${Math.min(index * 65, 260)}ms`;

		const meta = document.createElement('div');
		meta.className = 'news-meta';
		const date = document.createElement('time');
		date.className = 'news-date';
		date.dateTime = article.d || '';
		date.textContent = formatDate(article.d);
		const source = document.createElement('span');
		source.className = 'news-source';
		source.textContent = article.source || 'LiteStars';
		meta.append(date, source);

		const main = document.createElement('div');
		main.className = 'news-main';
		const title = document.createElement('h3');
		title.className = 'news-title';
		title.textContent = article.title || '제목 없는 뉴스';
		const excerpt = document.createElement('p');
		excerpt.className = 'news-excerpt';
		const plainText = getPlainText(article.content);
		excerpt.textContent = plainText.length > 220 ? `${plainText.slice(0, 220)}...` : plainText;

		const content = document.createElement('div');
		content.className = 'news-content';
		renderArticleContent(content, article.content);

		const toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = 'article-toggle';
		toggle.setAttribute('aria-expanded', 'false');
		toggle.innerHTML = '전문 보기 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
		toggle.addEventListener('click', () => {
			const isOpen = card.classList.toggle('is-open');
			toggle.setAttribute('aria-expanded', String(isOpen));
			toggle.firstChild.textContent = isOpen ? '접기 ' : '전문 보기 ';
		});

		main.append(title, excerpt, content, toggle);
		card.append(meta, main);
		fragment.append(card);
	});
	newsList.replaceChildren(fragment);
}

async function loadNews() {
	refreshButton.disabled = true;
	newsList.setAttribute('aria-busy', 'true');
	if (articles.length === 0) {
		const loading = document.createElement('div');
		loading.className = 'loading-state';
		loading.innerHTML = '<span class="loading-mark" aria-hidden="true">✳</span><span>소식을 불러오고 있어요</span>';
		newsList.replaceChildren(loading);
	}

	try {
		const response = await fetch(NEWS_URL, { cache: 'no-store' });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data = await response.json();
		if (!Array.isArray(data.newsList)) throw new Error('뉴스 목록 형식이 올바르지 않습니다.');
		articles = data.newsList.map((item) => ({
			title: item.t?.ko || item.t?.en || '',
			content: item.c?.ko || item.c?.en || '',
			d: item.d || '',
			source: item.g || 'LiteStars'
		}));
		renderNews();
	} catch (error) {
		console.error('뉴스를 불러오지 못했습니다.', error);
		showEmptyState('뉴스를 불러오지 못했어요', '연결을 확인한 뒤 새로고침 버튼을 눌러주세요.');
		feedCount.textContent = '연결 오류';
	} finally {
		newsList.setAttribute('aria-busy', 'false');
		refreshButton.disabled = false;
	}
}

searchInput.addEventListener('input', renderNews);
sortSelect.addEventListener('change', renderNews);
refreshButton.addEventListener('click', loadNews);
loadNews();
