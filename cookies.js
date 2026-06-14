const GA_ID = 'G-2E7SZ7C7WP';
const banner = document.getElementById('cookieBanner');
const acceptBtn = document.getElementById('cookieAccept');
const declineBtn = document.getElementById('cookieDecline');

const consent = localStorage.getItem('cookieConsent');

if (!consent) {
  banner.classList.remove('hidden');
} else if (consent === 'accepted') {
  loadAnalytics();
}

acceptBtn.addEventListener('click', () => {
  localStorage.setItem('cookieConsent', 'accepted');
  banner.classList.add('hidden');
  loadAnalytics();
});

declineBtn.addEventListener('click', () => {
  localStorage.setItem('cookieConsent', 'declined');
  banner.classList.add('hidden');
});

function loadAnalytics() {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
  gtag('js', new Date());
  gtag('config', GA_ID);
}