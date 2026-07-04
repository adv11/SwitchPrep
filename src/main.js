import { authApi } from './services/firebase.js';
import { createRoadmapStore } from './services/roadmapStore.js';
import { initTheme } from './services/theme.js';
import { startRouter, registerRoute, navigate, getRoute } from './ui/router.js';
import { renderSignIn } from './ui/pages/signIn.js';
import { renderSignUp } from './ui/pages/signUp.js';
import { renderDashboard } from './ui/pages/dashboard.js';

initTheme();

const app = document.getElementById('app');
const store = createRoadmapStore();

let currentUser = null;
let routeCleanup = null;

function guardApp(renderFn) {
  return ctx => {
    if (routeCleanup) {
      routeCleanup();
      routeCleanup = null;
    }
    routeCleanup = renderFn(app, { ...ctx, user: currentUser, store }) || null;
  };
}

authApi.onChange(user => {
  currentUser = user;
  store.setUser(user);

  const route = getRoute();
  const publicRoutes = ['/signin', '/signup'];
  if (!user && !publicRoutes.includes(route)) {
    navigate('/signin', true);
    return;
  }
  if (user && publicRoutes.includes(route)) {
    navigate('/app', true);
  }
});

registerRoute('/signin', guardApp(renderSignIn));
registerRoute('/signup', guardApp(renderSignUp));
registerRoute('/app', guardApp(renderDashboard));
registerRoute('/', () => navigate(currentUser ? '/app' : '/signin', true));

startRouter('/signin');
