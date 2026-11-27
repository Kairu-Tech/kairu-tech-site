'use strict';
window.crmConnection = (() => {
  const base = 'https://ypffaagjhrrgxsrxlluo.supabase.co';
  const publicKey = 'sb_publishable_7jktpHL7miMlzFEK-49uzQ_xKVw1wMI';
  const storageKey = 'kairutech-crm-session';
  let session = null;
  let refreshPromise = null;
  let sessionEpoch = 0;
  const sessionChanged = epoch => epoch !== sessionEpoch;
  const canceled = () => Error('La sesión ha cambiado. Vuelve a iniciar sesión.');

  function storeSession(value) {
    if (!value) { sessionEpoch++; refreshPromise = null; }
    session = value;
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
    else sessionStorage.removeItem(storageKey);
  }

  let qrUrl = null;
  function clearMfaQr() {
    const img = document.getElementById('mfa-qr');
    if (img) { img.hidden = true; img.removeAttribute('src'); }
    if (qrUrl) URL.revokeObjectURL(qrUrl);
    qrUrl = null;
    const secret = document.getElementById('mfa-secret');
    if (secret) { secret.textContent = ''; secret.hidden = true; }
  }
  function showMfaQr(value) {
    if (typeof value !== 'string') return;
    const prefix = 'data:image/svg+xml;utf-8,';
    let svg = value;
    if (svg.startsWith(prefix)) {
      svg = svg.slice(prefix.length);
      if (!svg.trim().startsWith('<')) svg = decodeURIComponent(svg);
    }
    if (!svg.trim().startsWith('<svg') && !svg.trim().startsWith('<?xml')) return;
    const img = document.getElementById('mfa-qr');
    if (!img) return;
    qrUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.src = qrUrl;
    img.hidden = false;
  }
  function showLogin(message = '') {
    clearMfaQr();
    const mfaForm = document.getElementById('mfa-form');
    if (mfaForm) { mfaForm.hidden = true; mfaForm.reset(); mfaForm.onsubmit = null; }
    const mfaError = document.getElementById('mfa-error');
    if (mfaError) mfaError.textContent = '';
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
      const epoch = sessionEpoch;
      const currentRefreshToken = session.refresh_token;
      const pending = (async () => {
        const response = await fetch(base + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { apikey: publicKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: currentRefreshToken })
        });
        if (sessionChanged(epoch)) throw canceled();
        if (!response.ok) {
          showLogin('Tu sesión ha caducado. Vuelve a entrar.');
          throw Error('Tu sesión ha caducado.');
        }
        const data = await response.json();
        if (sessionChanged(epoch)) throw canceled();
        storeSession({ ...data, expires_at: data.expires_at || Math.floor(Date.now()/1000) + data.expires_in });
        return data.access_token;
      })().finally(() => { if (refreshPromise === pending) refreshPromise = null; });
      refreshPromise = pending;
    }
    return refreshPromise;
  }

  async function request(path, options = {}) {
    const epoch = sessionEpoch;
    const accessToken = await token();
    if (sessionChanged(epoch)) throw canceled();
    const response = await fetch(base + '/rest/v1/' + path, {
      ...options,
      headers: {
        apikey: publicKey,
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (sessionChanged(epoch)) throw canceled();
    if (response.status === 401) {
      showLogin('Tu sesión ha caducado. Vuelve a entrar.');
      throw Error('Vuelve a iniciar sesión.');
    }
    const result = await response.json().catch(() => null);
    if (sessionChanged(epoch)) throw canceled();
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
      let part = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      part += '='.repeat((4-part.length%4)%4);
      return JSON.parse(atob(part)).aal;
    } catch { return null; }
  }

  async function authMfa(path, method = 'GET', body) {
    const epoch = sessionEpoch;
    const response = await fetch(base + '/auth/v1/' + path, {
      method, headers: { apikey: publicKey, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    if (sessionChanged(epoch)) throw canceled();
    if (!response.ok) throw Error('No se pudo completar la verificación. Comprueba el código o vuelve a iniciar sesión.');
    const result = await response.json().catch(() => null);
    if (sessionChanged(epoch)) throw canceled();
    return result;
  }

  async function requireMfa() {
    const epoch = sessionEpoch;
    await token();
    if (sessionChanged(epoch)) throw canceled();
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
    clearMfaQr();
    const secret = document.getElementById('mfa-secret');
    secret.textContent = '';
    secret.hidden = true;
    document.getElementById('mfa-help').textContent = 'Introduce el código de tu aplicación de autenticación.';
    if (!factor) {
      for (const pending of factors.filter(f => f.status === 'unverified')) {
        await authMfa('factors/' + encodeURIComponent(pending.id), 'DELETE');
      }
      factor = await authMfa('factors', 'POST', { factor_type: 'totp', friendly_name: 'KairuTech' });
      try { showMfaQr(factor.totp.qr_code); } catch { /* Manual fallback */ }
      secret.textContent = factor.totp.secret;
      secret.hidden = false;
      document.getElementById('mfa-help').textContent = 'En Microsoft Authenticator añade una cuenta de otro tipo y escanea el QR. Si no aparece o no puedes escanearlo, utiliza la clave manual de abajo. Introduce el código de seis dígitos. No compartas el QR ni la clave.';
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
        if (sessionChanged(epoch)) throw canceled();
        storeSession({ ...session, ...data, expires_at: data.expires_at || Math.floor(Date.now()/1000) + data.expires_in });
        if (assurance() !== 'aal2') throw Error('No se confirmó el segundo factor.');
        clearMfaQr();
        form.reset();
        form.hidden = true;
        await unlock();
      } catch (e) { if (!sessionChanged(epoch)) { error.textContent = e.message; form.hidden = false; } }
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
    const epoch = sessionEpoch;
    const fragment = new URLSearchParams(location.hash.slice(1));
    if (fragment.has('access_token') || fragment.has('error')) {
      window.history.replaceState(null, '', location.pathname + location.search);
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
      if (sessionChanged(epoch)) throw canceled();
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
    document.getElementById('cancel-mfa')?.addEventListener('click', () => { clearMfaQr(); logout(); });
    document.getElementById('cancel-reset').addEventListener('click', () => logout());
    document.getElementById('login-form').addEventListener('submit', async event => {
      event.preventDefault();
      storeSession(null);
      const epoch = sessionEpoch;
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
        if (sessionChanged(epoch)) throw canceled();
        if (!response.ok) throw Error('No se pudo iniciar sesión. Comprueba tu email y contraseña.');
        const data = await response.json();
        if (sessionChanged(epoch)) throw canceled();
        storeSession({ ...data, expires_at: data.expires_at || Math.floor(Date.now()/1000) + data.expires_in });
        form.elements.password.value = '';
        await unlock();
      } catch (error) {
        if (!sessionChanged(epoch)) showLogin(error.message);
      } finally {
        submit.disabled = false;
      }
    });
    const startupEpoch = sessionEpoch;
    try {
      await restoreAccess();
    } catch (error) {
      if (!sessionChanged(startupEpoch)) showLogin(error.message);
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
