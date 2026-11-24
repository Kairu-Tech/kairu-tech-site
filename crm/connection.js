'use strict';
window.crmConnection = (() => {
  const base = 'https://ypffaagjhrrgxsrxlluo.supabase.co';
  const publicKey = 'sb_publishable_7jktpHL7miMlzFEK-49uzQ_xKVw1wMI';
  const storageKey = 'kairutech-crm-session';
  let session = null;
  let refreshPromise = null;

  function storeSession(value) {
    session = value;
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
    else sessionStorage.removeItem(storageKey);
  }

  function showLogin(message = '') {
    storeSession(null);
    sessionStorage.removeItem(storageKey + '-recovery');
    document.getElementById('login-form').hidden = false;
    document.getElementById('reset-form').hidden = true;
    document.querySelector('.shell').hidden = true;
    const modal = document.getElementById('modal');
    if (modal.open) modal.close();
    document.getElementById('login').hidden = false;
    document.getElementById('login-error').textContent = message;
    window.dispatchEvent(new Event('crm-locked'));
  }

  async function token() {
    if (!session) throw Error('Inicia sesión para continuar.');
    if (session.expires_at * 1000 > Date.now() + 60000) return session.access_token;
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const response = await fetch(base + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { apikey: publicKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        if (!response.ok) {
          showLogin('Tu sesión ha caducado. Vuelve a entrar.');
          throw Error('Tu sesión ha caducado.');
        }
        const data = await response.json();
        storeSession({ ...data, expires_at: data.expires_at || Math.floor(Date.now()/1000) + data.expires_in });
        return data.access_token;
      })().finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  }

  async function request(path, options = {}) {
    const accessToken = await token();
    const response = await fetch(base + '/rest/v1/' + path, {
      ...options,
      headers: {
        apikey: publicKey,
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (response.status === 401) {
      showLogin('Tu sesión ha caducado. Vuelve a entrar.');
      throw Error('Vuelve a iniciar sesión.');
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const message = result?.code === 'P0001' ? result.message : response.status === 403
        ? 'Tu usuario no tiene permiso para acceder al CRM.'
        : 'No se pudo guardar o consultar la información. Comprueba la conexión y vuelve a intentarlo.';
      throw Object.assign(Error(message), { status: response.status, code: result?.code });
    }
    return result;
  }

  async function unlock() {
    const projects = await request('crm_projects?select=id,name&order=name');
    if (!projects?.length) throw Error('Tu usuario todavía no tiene acceso. Revisa la consulta de usuario propietario.');
    document.getElementById('login').hidden = true;
    document.querySelector('.shell').hidden = false;
    window.dispatchEvent(new Event('crm-ready'));
  }

  function showReset() {
    document.querySelector('.shell').hidden = true;
    document.getElementById('login').hidden = false;
    document.getElementById('login-form').hidden = true;
    document.getElementById('reset-form').hidden = false;
    sessionStorage.setItem(storageKey + '-recovery', 'true');
  }

  async function restoreAccess() {
    const fragment = new URLSearchParams(location.hash.slice(1));
    if (fragment.has('access_token') || fragment.has('error')) {
      history.replaceState(null, '', location.pathname + location.search);
      if (fragment.has('error')) {
        throw Error('El enlace ha caducado o ya se ha utilizado. Solicita un nuevo correo.');
      }
      if (fragment.get('type') !== 'recovery' || !fragment.get('refresh_token')) {
        throw Error('Solicita un nuevo enlace para cambiar la contraseña.');
      }
      const accessToken = fragment.get('access_token');
      const response = await fetch(base + '/auth/v1/user', {
        headers: { apikey: publicKey, Authorization: 'Bearer ' + accessToken }
      });
      if (!response.ok) throw Error('El enlace no es válido. Solicita un nuevo correo.');
      const user = await response.json();
      storeSession({
        access_token: accessToken,
        refresh_token: fragment.get('refresh_token'),
        expires_at: Math.floor(Date.now()/1000) + Number(fragment.get('expires_in') || 3600),
        user
      });
      showReset();
      return;
    }
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return;
    session = JSON.parse(saved);
    if (sessionStorage.getItem(storageKey + '-recovery')) showReset();
    else await unlock();
  }

  async function start() {
    document.getElementById('forgot-password').addEventListener('click', async event => {
      const form = document.getElementById('login-form');
      const email = form.elements.email;
      if (!email.reportValidity()) return;
      const button = event.target;
      button.disabled = true;
      try {
        const redirect = new URL('./', location.href).href.split('#')[0];
        const response = await fetch(base + '/auth/v1/recover?redirect_to=' + encodeURIComponent(redirect), {
          method: 'POST',
          headers: { apikey: publicKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.value.trim() })
        });
        if (!response.ok) throw Error(response.status === 429
          ? 'Espera unos minutos antes de solicitar otro correo.'
          : 'No se pudo enviar el correo. Inténtalo de nuevo.');
        document.getElementById('login-error').textContent = 'Si el email tiene una cuenta, recibirás un enlace para cambiar la contraseña.';
      } catch (error) {
        document.getElementById('login-error').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
    document.getElementById('reset-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.target;
      const password = form.elements.password.value;
      const confirmation = form.elements.confirmation.value;
      const message = document.getElementById('reset-error');
      if (password !== confirmation) {
        message.textContent = 'Las dos contraseñas deben coincidir.';
        return;
      }
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      message.textContent = '';
      try {
        const accessToken = await token();
        const response = await fetch(base + '/auth/v1/user', {
          method: 'PUT',
          headers: { apikey: publicKey, Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          const errors = {
            weak_password: 'La contraseña no cumple los requisitos de seguridad.',
            same_password: 'Elige una contraseña diferente a la anterior.',
            reauthentication_needed: 'Solicita un nuevo enlace para confirmar el cambio.',
            session_not_found: 'Solicita un nuevo enlace para cambiar la contraseña.'
          };
          throw Error(errors[result.code] || 'No se pudo cambiar la contraseña. Solicita un nuevo enlace e inténtalo de nuevo.');
        }
        form.reset();
        await logout();
        document.getElementById('login-error').textContent = 'Contraseña actualizada. Ya puedes entrar con la nueva.';
      } catch (error) {
        message.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
    document.getElementById('cancel-reset').addEventListener('click', () => logout());
    document.getElementById('login-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.target;
      const submit = form.querySelector('button');
      submit.disabled = true;
      document.getElementById('login-error').textContent = '';
      try {
        const response = await fetch(base + '/auth/v1/token?grant_type=password', {
          method: 'POST',
          headers: { apikey: publicKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.elements.email.value.trim(), password: form.elements.password.value })
        });
        if (!response.ok) throw Error('No se pudo iniciar sesión. Comprueba tu email y contraseña.');
        const data = await response.json();
        storeSession({ ...data, expires_at: data.expires_at || Math.floor(Date.now()/1000) + data.expires_in });
        form.elements.password.value = '';
        await unlock();
      } catch (error) {
        showLogin(error.message);
      } finally {
        submit.disabled = false;
      }
    });
    try {
      await restoreAccess();
    } catch (error) {
      showLogin(error.message);
    }
  }

  async function logout() {
    const accessToken = session?.access_token;
    showLogin();
    if (accessToken) {
      await fetch(base + '/auth/v1/logout?scope=local', {
        method: 'POST',
        headers: { apikey: publicKey, Authorization: 'Bearer ' + accessToken }
      }).catch(() => {});
    }
  }

  addEventListener('DOMContentLoaded', start);
  return { request, logout, isSignedIn: () => Boolean(session) };
})();
