import { el } from '../dom.js';
import { navigate } from '../router.js';
import { authApi, authErrorMessage } from '../../services/firebase.js';
import { setInitialAccessToken } from '../../services/googleDriveAuth.js';
import { showToast } from '../components/toast.js';
import { authShell } from '../components/authShell.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { makePasswordToggle } from '../utils/password.js';

export function renderSignIn(app, { user }) {
  if (user && !user.isAnonymous) {
    navigate('/app', true);
    return;
  }

  const bodySlot = el('div', {});

  const { node, cleanup, titleEl, subtitleEl } = authShell({
    title: 'Welcome back',
    subtitle: 'Sign in to sync your roadmap across devices.',
    children: [bodySlot],
    footer: el('p', {}, [
      'New here? ',
      el('a', { href: '#/signup', className: 'link', text: 'Create an account' })
    ]),
    footnote: 'Built for anyone learning, revising, or tracking progress toward a goal.'
  });

  function showSignInView(prefillEmail = '') {
    titleEl.textContent = 'Welcome back';
    subtitleEl.textContent = 'Sign in to sync your roadmap across devices.';

    const message = el('p', { className: 'form-message', text: '' });
    const emailInput = el('input', {
      className: 'field-input', type: 'email',
      placeholder: 'you@example.com', autocomplete: 'username'
    });
    const passwordInput = el('input', {
      className: 'field-input', type: 'password',
      placeholder: 'Your password', autocomplete: 'current-password'
    });
    const submitBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-block', text: 'Sign in' });
    const googleBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: 'Sign in with Google' });
    const guestBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: 'Continue as guest' });
    const forgotBtn = el('button', { type: 'button', className: 'forgot-link', text: 'Forgot password?' });
    const rememberCheckbox = el('input', { type: 'checkbox', id: 'rememberMe', className: 'remember-checkbox', checked: 'true' });
    rememberCheckbox.checked = true;

    if (prefillEmail) emailInput.value = prefillEmail;

    function setBusy(busy) {
      submitBtn.disabled = busy;
      googleBtn.disabled = busy;
      guestBtn.disabled = busy;
      forgotBtn.disabled = busy;
    }

    async function handleSubmit(e) {
      e.preventDefault();
      message.textContent = '';
      message.className = 'form-message';
      const emailVal = emailInput.value.trim();
      const passVal = passwordInput.value;
      if (!emailVal || !passVal) {
        message.textContent = 'Enter email and password.';
        message.className = 'form-message error';
        return;
      }
      setBusy(true);
      try {
        await authApi.setPersistence(rememberCheckbox.checked);
        await authApi.signIn(emailVal, passVal);
        showToast('Signed in. Syncing your roadmap…', 'success');
        navigate('/app', true);
      } catch (error) {
        message.textContent = authErrorMessage(error);
        message.className = 'form-message error';
      } finally {
        setBusy(false);
      }
    }

    async function handleGoogleSignIn() {
      const proceed = await confirmDialog({
        title: 'Sign in with Google',
        message: 'This will save your progress to a private folder in your Google Drive that only this app can access — nothing else in your Drive is touched.',
        confirmText: 'Continue',
        cancelText: 'Cancel'
      });
      if (!proceed) return;

      message.textContent = '';
      message.className = 'form-message';
      setBusy(true);
      try {
        // One popup does both identity and Drive consent (see firebase.js's
        // signInWithGoogle()) — chaining two sequential popups let the
        // browser's user-gesture window lapse between them and the second
        // one was frequently auto-closed on a real click. Seed the token
        // into googleDriveAuth.js immediately so a Google user's very next
        // store.setUser() -> googleDriveAdapter.getMeta() call (triggered by
        // main.js's authApi.onChange, which can fire as early as this same
        // popup resolving) has a usable token in memory.
        const { driveAccessToken } = await authApi.signInWithGoogle();
        if (!driveAccessToken) throw new Error('Could not get Google Drive access. Please try again.');
        setInitialAccessToken(driveAccessToken);
        showToast('Signed in with Google. Syncing your roadmap…', 'success');
        navigate('/app', true);
      } catch (error) {
        await authApi.signOut().catch(() => {});
        message.textContent = authErrorMessage(error);
        message.className = 'form-message error';
      } finally {
        setBusy(false);
      }
    }

    googleBtn.addEventListener('click', handleGoogleSignIn);

    guestBtn.addEventListener('click', async () => {
      message.textContent = '';
      setBusy(true);
      try {
        await authApi.guest();
        showToast('Guest session started. Create an account anytime to keep progress.', 'info');
        navigate('/app', true);
      } catch (error) {
        message.textContent = authErrorMessage(error);
        message.className = 'form-message error';
      } finally {
        setBusy(false);
      }
    });

    forgotBtn.addEventListener('click', () => showResetView(emailInput.value.trim()));

    const form = el('form', { className: 'auth-form', onSubmit: handleSubmit }, [
      googleBtn,
      el('div', { className: 'auth-divider' }, [el('span', { text: 'or' })]),
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Email' }),
        emailInput
      ]),
      el('div', { className: 'field' }, [
        el('div', { className: 'field-label-row' }, [
          el('span', { className: 'field-label', text: 'Password' }),
          forgotBtn
        ]),
        el('div', { className: 'field-input-wrap' }, [
          passwordInput,
          makePasswordToggle(passwordInput),
        ]),
      ]),
      el('label', { className: 'remember-row', for: 'rememberMe' }, [
        rememberCheckbox,
        el('span', { className: 'remember-label', text: 'Keep me signed in' })
      ]),
      message,
      submitBtn,
      el('div', { className: 'auth-divider' }, [el('span', { text: 'or' })]),
      guestBtn
    ]);

    bodySlot.replaceChildren(form);
  }

  function showResetView(prefillEmail = '') {
    titleEl.textContent = 'Reset your password';
    subtitleEl.textContent = "Enter your email and we'll send you a link to set a new one.";

    const message = el('p', { className: 'form-message', text: '' });
    const resetEmailInput = el('input', {
      className: 'field-input', type: 'email',
      placeholder: 'you@example.com', autocomplete: 'username'
    });
    const sendBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-block', text: 'Send reset link' });
    const backBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: '← Back to sign in' });

    if (prefillEmail) resetEmailInput.value = prefillEmail;

    function setBusy(busy) {
      sendBtn.disabled = busy;
      backBtn.disabled = busy;
    }

    backBtn.addEventListener('click', () => showSignInView(resetEmailInput.value.trim()));

    async function handleReset(e) {
      e.preventDefault();
      message.textContent = '';
      message.className = 'form-message';
      const emailVal = resetEmailInput.value.trim();
      if (!emailVal) {
        message.textContent = 'Enter your email address.';
        message.className = 'form-message error';
        return;
      }
      setBusy(true);
      try {
        await authApi.sendResetEmail(emailVal);
        showResetSuccess(emailVal);
      } catch (error) {
        // Only surface network errors — never reveal whether an account exists
        if (error?.code === 'auth/network-request-failed') {
          message.textContent = 'Network error. Check your connection and try again.';
          message.className = 'form-message error';
          setBusy(false);
        } else {
          showResetSuccess(emailVal);
        }
      }
    }

    const form = el('form', { className: 'auth-form', onSubmit: handleReset }, [
      el('label', { className: 'field' }, [
        el('span', { className: 'field-label', text: 'Email' }),
        resetEmailInput
      ]),
      message,
      sendBtn,
      backBtn
    ]);

    bodySlot.replaceChildren(form);
    resetEmailInput.focus();
  }

  function showResetSuccess(sentEmail) {
    titleEl.textContent = 'Check your inbox';
    subtitleEl.textContent = '';

    const backBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: '← Back to sign in' });
    backBtn.addEventListener('click', () => showSignInView(sentEmail));

    bodySlot.replaceChildren(
      el('p', { className: 'reset-success-msg' }, [
        el('span', { className: 'reset-success-icon', text: '✓' }),
        el('span', { text: `We sent a reset link to ${sentEmail}. The link expires in 1 hour.` })
      ]),
      backBtn
    );
  }

  showSignInView();
  app.replaceChildren(node);
  return cleanup;
}
