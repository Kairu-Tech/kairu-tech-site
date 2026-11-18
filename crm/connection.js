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
      const message = response.status === 403
        ? 'Tu usuario no tiene permiso para acceder al CRM.'
        : 'No se pudo guardar o consultar la información. Comprueba la conexión y vuelve a intentarlo.';
      throw Object.assign(Error(message), { status: response.status });
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

  async function start() {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        session = JSON.parse(saved);
        await unlock();
      }
    } catch (error) {
      showLogin(error.message);
    }
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
