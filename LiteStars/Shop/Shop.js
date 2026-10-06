const SHOP_URL = 'https://litestar.pages.dev/api/shop.json';
const LITER_DATA_URL = '../LiterData';

const offerList = document.querySelector('#offer-list');
const feedCount = document.querySelector('#feed-count');
const searchInput = document.querySelector('#offer-search');
const categoryFilters = document.querySelector('#category-filters');
const refreshButton = document.querySelector('#refresh-offers');
const exitButton = document.querySelector('#exit-news');
const detailDialog = document.querySelector('#offer-detail');
const detailContent = document.querySelector('#detail-content');
const closeDetailButton = document.querySelector('#close-detail');

let offers = [];
let activeCategory = 'all';
let selectedOffer = null;
let literNames = [
	'Mdx-runner', 'StarMan', 'yppup', 'Miner', 'NyangNyang', 'Gandy',
	'MathMan', 'Guard', 'Ziggy', 'NanoMan', 'Souplesse', 'Egygy',
	'Examine', 'Panda', 'God', 'StarDeath', 'Sori', 'Airless'
];

const RESOURCE_LABELS = {
	LiteDrop: 'LiteDrop',
	NanoGas: '나노 가스',
	NanoGem: '나노 젬',
	NanoPower: '나노 파워',
	NanoCoin: '나노 코인',
	Liter: '라이터'
};

function handleExit() {
	if (window.Unity) {
		window.Unity.call('close');
	} else {
		window.open('https://litestar.pages.dev/', '_self');
	}
}

function formatDate(value) {
	if (!value) return '기간 미정';
	const date = new Date(`${value}T00:00:00`);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function getOfferPeriod(offer) {
	if (!offer.start && !offer.end) return '상시 판매';
	return `${formatDate(offer.start)} - ${formatDate(offer.end)}`;
}

function getRewardLabel(reward) {
	return Object.entries(reward || {}).map(([name, value]) => {
		const formatValue = (entry, key = '') => {
			if (key === 'LiterNumber') {
				const literNumber = Number(entry);
				return Number.isInteger(literNumber) && literNumber > 0
					? literNames[literNumber - 1] || `라이터 번호 ${literNumber}`
					: `라이터 번호 ${entry}`;
			}
			if (Array.isArray(entry)) return entry.length ? entry.map((item) => formatValue(item)).join(', ') : '보상 상세 없음';
			if (entry && typeof entry === 'object') {
				return Object.entries(entry).map(([key, nested]) => {
					const label = { Grade: '등급', Quantity: '수량', Level: '레벨' }[key];
					const formatted = formatValue(nested, key);
					return label ? `${label} ${formatted}` : formatted;
				}).join(' · ');
			}
			return entry === null || entry === undefined ? '' : String(entry);
		};
		const details = formatValue(value);
		const label = RESOURCE_LABELS[name] || name;
		return details ? `${label} · ${details}` : label;
	});
}

function getCostLabel(cost) {
	if (!cost || typeof cost !== 'object' || Object.keys(cost).length === 0) return '무료';
	return Object.entries(cost).map(([name, value]) => {
		const quantity = typeof value === 'object' && value !== null ? value.Quantity : value;
		const formattedQuantity = typeof quantity === 'number' ? new Intl.NumberFormat('ko-KR').format(quantity) : quantity;
		return quantity === undefined ? RESOURCE_LABELS[name] || name : `${formattedQuantity} ${RESOURCE_LABELS[name] || name}`;
	}).join(', ');
}

async function loadLiterNames() {
	try {
		const response = await fetch(LITER_DATA_URL, { cache: 'no-store' });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const text = await response.text();
		if (text.trimStart().startsWith('<')) throw new Error('라이터 이름 파일 대신 HTML 응답을 받았습니다.');
		const names = text.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
		if (names.length > 0) literNames = names;
		if (offers.length > 0) renderOffers();
	} catch (error) {
		console.warn('라이터 이름 데이터를 불러오지 못했습니다.', error);
	}
}

function makeElement(tag, className, text) {
	const element = document.createElement(tag);
	if (className) element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}

function showEmptyState(title, message) {
	const state = makeElement('div', 'empty-state');
	state.append(makeElement('strong', '', title), makeElement('span', '', message));
	offerList.replaceChildren(state);
}

function getCategories() {
	return [...new Set(offers.map((offer) => offer.category || 'General'))].sort((left, right) => left.localeCompare(right));
}

function renderCategoryFilters() {
	const fragment = document.createDocumentFragment();
	const categories = [{ id: 'all', label: '전체' }, ...getCategories().map((category) => ({ id: category, label: category }))];
	categories.forEach(({ id, label }) => {
		const button = makeElement('button', `category-chip${activeCategory === id ? ' is-active' : ''}`, label);
		button.type = 'button';
		button.setAttribute('aria-pressed', String(activeCategory === id));
		button.addEventListener('click', () => {
			activeCategory = id;
			renderCategoryFilters();
			renderOffers();
		});
		fragment.append(button);
	});
	categoryFilters.replaceChildren(fragment);
}

function renderOfferCard(offer) {
	const card = makeElement('article', 'offer-card');
	const art = makeElement('div', 'offer-art');
	art.setAttribute('aria-hidden', 'true');
	art.append(makeElement('span', 'offer-art-mark', '✳'));
	const category = makeElement('span', 'offer-category', offer.category || 'General');
	const title = makeElement('h3', 'offer-title', offer.title || '이름 없는 오퍼');
	const description = makeElement('p', 'offer-description', offer.desc || '상세 정보가 없습니다.');
	const rewards = getRewardLabel(offer.reward);
	const reward = makeElement('p', 'offer-reward', rewards.length ? rewards.join(', ') : '보상 정보 없음');
	const cost = makeElement('p', 'offer-cost', getCostLabel(offer.cost));
	const footer = makeElement('div', 'offer-card-footer');
	footer.append(makeElement('span', 'offer-period', getOfferPeriod(offer)));
	const viewButton = makeElement('button', 'offer-view-button', '자세히 보기');
	viewButton.type = 'button';
	viewButton.addEventListener('click', () => openOfferDetail(offer));
	footer.append(viewButton);
	card.append(art, category, title, description, reward, cost, footer);
	return card;
}

function renderOffers() {
	const query = searchInput.value.trim().toLocaleLowerCase('ko');
	const filtered = offers.filter((offer) => {
		const category = offer.category || 'General';
		const matchesCategory = activeCategory === 'all' || category === activeCategory;
		const searchable = `${offer.title} ${offer.desc} ${category} ${offer.id}`.toLocaleLowerCase('ko');
		return matchesCategory && searchable.includes(query);
	});
	feedCount.textContent = `${filtered.length}개 오퍼`;
	if (filtered.length === 0) {
		showEmptyState(query ? '검색 결과가 없어요' : '등록된 오퍼가 없어요', query ? '다른 검색어나 카테고리를 선택해 보세요.' : '새로운 오퍼가 등록되면 이곳에 표시됩니다.');
		return;
	}

	const groups = new Map();
	filtered.forEach((offer) => {
		const category = offer.category || 'General';
		if (!groups.has(category)) groups.set(category, []);
		groups.get(category).push(offer);
	});
	const fragment = document.createDocumentFragment();
	groups.forEach((groupOffers, category) => {
		const section = makeElement('section', 'offer-category-section');
		section.setAttribute('aria-label', `${category} 카테고리 오퍼`);
		const heading = makeElement('div', 'offer-group-heading');
		heading.append(makeElement('h3', '', category), makeElement('span', '', `${groupOffers.length} offers`));
		const grid = makeElement('div', 'offer-grid');
		groupOffers.forEach((offer) => grid.append(renderOfferCard(offer)));
		section.append(heading, grid);
		fragment.append(section);
	});
	offerList.replaceChildren(fragment);
}

function openOfferDetail(offer) {
	selectedOffer = offer;
	const heading = makeElement('h2', 'detail-title', offer.title || '이름 없는 오퍼');
	heading.id = 'detail-title';
	const description = makeElement('p', 'detail-description', offer.desc || '상세 정보가 없습니다.');
	const info = makeElement('dl', 'detail-info');
	[
		['카테고리', offer.category || 'General'],
		['판매 기간', getOfferPeriod(offer)],
		['비용', getCostLabel(offer.cost)],
		['오퍼 ID', offer.id || 'ID 없음']
	].forEach(([label, value]) => {
		info.append(makeElement('dt', '', label), makeElement('dd', '', value));
	});
	const rewards = makeElement('section', 'detail-rewards');
	rewards.append(makeElement('h3', '', '포함 보상'));
	const rewardList = makeElement('ul', '');
	const rewardLabels = getRewardLabel(offer.reward);
	(rewardLabels.length ? rewardLabels : ['보상 정보 없음']).forEach((label) => rewardList.append(makeElement('li', '', label)));
	rewards.append(rewardList);
	const actions = makeElement('div', 'detail-actions');
	const purchaseButton = makeElement('button', 'purchase-button', '구매하기');
	purchaseButton.type = 'button';
	purchaseButton.disabled = !offer.id;
	purchaseButton.addEventListener('click', purchaseSelectedOffer);
	const notice = makeElement('p', 'purchase-notice');
	actions.append(purchaseButton);
	detailContent.replaceChildren(heading, description, info, rewards, notice, actions);
	if (typeof detailDialog.showModal === 'function') detailDialog.showModal();
	else detailDialog.setAttribute('open', '');
}

function purchaseSelectedOffer() {
	if (!selectedOffer?.id) return;
	if (!window.Unity) {
		detailContent.querySelector('.purchase-notice').textContent = 'Unity 앱 안에서 구매할 수 있어요.';
		return;
	}
	window.Unity.call(JSON.stringify({ action: 'purchase', id: selectedOffer.id }));
	detailContent.querySelector('.purchase-notice').textContent = '구매 요청을 앱으로 보냈어요.';
}

async function loadOffers() {
	refreshButton.disabled = true;
	offerList.setAttribute('aria-busy', 'true');
	if (offers.length === 0) {
		const loading = makeElement('div', 'loading-state');
		loading.append(makeElement('span', 'loading-mark', '✳'), makeElement('span', '', '오퍼를 불러오고 있어요'));
		offerList.replaceChildren(loading);
	}

	try {
		const response = await fetch(SHOP_URL, { cache: 'no-store' });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data = await response.json();
		if (!Array.isArray(data.list)) throw new Error('오퍼 목록 형식이 올바르지 않습니다.');
		offers = data.list.map((item) => ({
			id: item.id || '',
			title: item.title?.ko || item.title?.en || '',
			desc: item.desc?.ko || item.desc?.en || '',
			start: item.start || '',
			end: item.end || '',
			cost: item.cost || {},
			category: item.category || 'General',
			reward: item.reward || {}
		}));
		activeCategory = 'all';
		renderCategoryFilters();
		renderOffers();
	} catch (error) {
		console.error('상점 오퍼를 불러오지 못했습니다.', error);
		showEmptyState('오퍼를 불러오지 못했어요', '연결을 확인한 뒤 새로고침 버튼을 눌러주세요.');
		feedCount.textContent = '연결 오류';
	} finally {
		offerList.setAttribute('aria-busy', 'false');
		refreshButton.disabled = false;
	}
}

searchInput.addEventListener('input', renderOffers);
refreshButton.addEventListener('click', loadOffers);
exitButton.addEventListener('click', handleExit);
closeDetailButton.addEventListener('click', () => detailDialog.close());
detailDialog.addEventListener('click', (event) => {
	if (event.target === detailDialog) detailDialog.close();
});
loadOffers();
loadLiterNames();
