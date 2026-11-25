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
    document.getElementById('mfa-form')?.setAttribute('hidden', '');
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

  function assurance() {
    try {
      const part = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(part)).aal;
    } catch { return null; }
  }

  async function authMfa(path, method = 'GET', body) {
    const response = await fetch(base + '/auth/v1/' + path, {
      method, headers: { apikey: publicKey, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (!response.ok) throw Error('No se pudo completar la verificación. Comprueba el código o vuelve a iniciar sesión.');
    return response.json().catch(() => null);
  }

  async function requireMfa() {
    await token();
    if (assurance() === 'aal2') return true;
    const user = await authMfa('user');
    const factors = (user.factors || []).filter(f => f.factor_type === 'totp');
    let factor = factors.find(f => f.status === 'verified');
    // Client portal remains unchanged unless the user has already enrolled MFA.
    if (!factor && document.body.dataset.portal === 'true') return true;
    const form = document.getElementById('mfa-form');
    if (!form) throw Error('Actualiza la página para verificar tu identidad.');
    document.getElementById('login-form').hidden = true;
    document.getElementById('reset-form').hidden = true;
    document.querySelector('.shell').hidden = true;
    document.getElementById('login').hidden = false;
    form.hidden = false;
    form.reset();
    const secret = document.getElementById('mfa-secret');
    secret.textContent = '';
    secret.hidden = true;
    document.getElementById('mfa-help').textContent = 'Introduce el código de tu aplicación de autenticación.';
    if (!factor) {
      for (const pending of factors.filter(f => f.status === 'unverified')) {
        await authMfa('factors/' + encodeURIComponent(pending.id), 'DELETE');
      }
      factor = await authMfa('factors', 'POST', { factor_type: 'totp', friendly_name: 'KairuTech' });
      secret.textContent = factor.totp.secret;
      secret.hidden = false;
      document.getElementById('mfa-help').textContent = 'En Microsoft Authenticator añade una cuenta de otro tipo y elige introducir la clave manualmente. Usa la clave siguiente y después introduce el código de seis dígitos. No compartas esta clave.';
    }
    form.onsubmit = async event => {
      event.preventDefault();
      const button = form.querySelector('[type=submit]');
      const error = document.getElementById('mfa-error');
      button.disabled = true;
      error.textContent = '';
      try {
        const path = 'factors/' + encodeURIComponent(factor.id);
        const challenge = await authMfa(path + '/challenge', 'POST', {});
        const data = await authMfa(path + '/verify', 'POST', { challenge_id: challenge.id, code: form.elements.code.value.trim() });
        storeSession({ ...session, ...data, expires_at: data.expires_at || Math.floor(Date.now()/1000) + data.expires_in });
        if (assurance() !== 'aal2') throw Error('No se confirmó el segundo factor.');
        secret.textContent = '';
        form.reset();
        form.hidden = true;
        await unlock();
      } catch (e) { error.textContent = e.message; form.hidden = false; }
      finally { button.disabled = false; }
    };
    return false;
  }

  async function unlock() {
    if (!await requireMfa()) return;
    const projects = document.body.dataset.portal === 'true'
      ? [await request('rpc/crm_portal_context', { method: 'POST', body: '{}' })]
      : await request('crm_projects?select=id,name&order=name');
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
      if (!['recovery','invite'].includes(fragment.get('type')) || !fragment.get('refresh_token')) {
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
    document.getElementById('cancel-mfa')?.addEventListener('click', () => { document.getElementById('mfa-secret').textContent = ''; logout(); });
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
