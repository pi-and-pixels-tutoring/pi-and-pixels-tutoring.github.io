(function () {

  /**
   *
   */
  const BTN_VARIANTS = Object.freeze({
    send: Object.freeze({
      disabled: false,
      body: '<span role="img" aria-hidden="true"></span> Send!',
      action: (elems) => (ev) => { ev.preventDefault(); processForm(elems, false); },
    }),
    retry: Object.freeze({
      disabled: false,
      body: '<span role="img" aria-hidden="true"></span> Send Anyway?',
      action: (elems) => (ev) => { ev.preventDefault(); processForm(elems, true); },
    }),
    work: Object.freeze({
      disabled: true,
      body: '<span role="img" class="block rotate" aria-hidden="true"></span> Processing...',
      action: () => (ev) => { ev.preventDefault(); }
    }),
    done: Object.freeze({
      disabled: true,
      body: '<span role="img" aria-hidden="true"></span> Thank You!',
      action: () => (ev) => { ev.preventDefault(); }
    }),
    sorry: Object.freeze({
      disabled: true,
      body: 'Sorry <span role="img" aria-hidden="true">😢</span>',
      action: () => (ev) => { ev.preventDefault(); }
    }),
  });

  /**
   *
   */
  document.addEventListener('DOMContentLoaded', () => {
    /** add feedback if we can */
    const clickables = document.querySelectorAll('a.button, a[role=button], button');
    clickables.forEach((elem) => elem.addEventListener('click', () => navigator.vibrate(10)));
    /** setup send button */
    mapResult(openFormElements(), (elems) => setBtnVariant(elems, BTN_VARIANTS.send));
  });

  /**
   *
   */
  function processForm(elems, force) {
    hideErrorBox(elems);
    setBtnVariant(elems, BTN_VARIANTS.work);

    pipe(
      openFormData(elems.form),
      $ => bindResult($, (data) => force ? filterEmpty(data) : verifyFormData(data)),
      $ => Promise.resolve($),
      $ => bindFuture($, (data) => sendFormData(data)),
      $ => tapFuture($, () => setBtnVariant(elems, BTN_VARIANTS.done)),
      $ => catchFuture($, (error) => processError(elems, error)),
    );
  }

  function openFormData(form) {
    return pipe(
      new FormData(form),
      $ => liftArray([ openValue($, 'name'), openValue($, 'mail'), openValue($, 'date'), openValue($, 'body') ]),
      $ => mapResult($, ([ name, mail, date, body ]) => Object.freeze({ name, mail, date, body })),
    );
  }

  function filterEmpty(data) {
    return data.name != '' || data.mail != '' || data.body != '' ? Okay(data) : Fail(Internal());
  }

  function verifyFormData(data) {
    const missingBits = [];

    if (data.name.length < 3) {
      missingBits.push('Name');
    }

    if (false === /^\S+@\S+\.\S+$/.test(data.mail)) {
      missingBits.push('Email');
    }

    if (data.body.length < 20) {
      missingBits.push('Message');
    }

    return missingBits.length === 0 ? Okay(data) : Fail(Missing(missingBits));
  }

  function sendFormData(data) {
    return fetch('https://script.google.com/macros/s/AKfycbxn7nZ6CMK0E2j-ibFDIKQKGxUxpKvkZeZqkykc2qnMqXjFAQc_AXnNtgAuYLj1JJBBRQ/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
      redirect: 'follow',
    })
    .then((resp) => resp.ok ? resp.json() : {})
    .then((data) => data.is == 'Okay' ? Okay() : Fail());
  }

  function processError(elems, error) {
    switch (error.is) {
    case 'Internal':
      setBtnVariant(elems, BTN_VARIANTS.sorry);
      showErrorBox(elems, 'An internal error has occured, please try again later.');
      break;
    case 'Missing':
      showErrorBox(elems, 'Please confirm the ' + error.what.join(', ') + ' fields before sending.');
      setBtnVariant(elems, BTN_VARIANTS.retry);
      break;
    }
  }

  /**
   *
   */
  function openValue(formData, propName) {
    return liftNullable(formData.get(propName), () => Internal('missing form data ' + propName));
  }

  function openFormElements() {
    return pipe(
      liftArray([ openElement('email-form'), openElement('email-send'), openElement('email-ebox'), openElement('email-emsg') ]),
      $ => mapResult($, ([ form, btn, box, msg ]) => Object.freeze({ form, btn, box, msg })),
    );
  }

  function openElement(name) {
    return liftNullable(document.getElementById(name), () => Internal('missing element #' + name));
  }

  function setBtnVariant(elems, variant) {
    elems.btn.disabled = variant.disabled;
    elems.btn.innerHTML = variant.body;
    elems.btn.addEventListener('click', variant.action(elems));
  }

  function showErrorBox(elems, msg) {
    elems.box.style.display = 'flex';
    elems.msg.innerHTML = msg;
  }

  function hideErrorBox(elems) {
    elems.box.style.display = 'none';
    elems.msg.innerHTML = '';
  }

  /**
   *
   */
  function Internal(msg) {
    return Object.freeze({ is: 'Internal', msg });
  }

  function Missing(what) {
    return Object.freeze({ is: 'Missing', what });
  }

  /**
   *
   */
  function Okay(value) {
    return Object.freeze({ is: 'Okay', value });
  }

  function Fail(error) {
    return Object.freeze({ is: 'Fail', error });
  }

  function liftArray(resArr) {
    const values = [];
    let result = Okay(values);

    for (let i = 0; i < resArr.length; ++i) {
      result = bindResult(resArr[i], $ => { values.push($); return result; });
    }

    return result;
  }

  function liftNullable(value, error) {
    return typeof value !== 'undefined' && value !== null ? Okay(value) : Fail(error());
  }

  function bindResult(res, fn) {
    switch (res.is) {
    case 'Okay': return fn(res.value);
    case 'Fail': return res;
    }
  }

  function mapResult(res, fn) {
    switch (res.is) {
    case 'Okay': return Okay(fn(res.value));
    case 'Fail': return res;
    }
  }

  function tapResult(res, fn) {
    switch (res.is) {
    case 'Okay': fn(res.value); return res;
    case 'Fail': return res;
    }
  }

  function catchResult(res, fn) {
    switch (res.is) {
    case 'Okay': return res;
    case 'Fail': return fn(res.error);
    }
  }

  /**
   *
   */
  function bindFuture(fut, fn) {
    return fut.then((res) => bindResult(res, fn));
  }

  function mapFuture(fut, fn) {
    return fut.then((res) => mapResult(res, fn));
  }

  function tapFuture(fut, fn) {
    return fut.then((res) => tapResult(res, fn));
  }

  function catchFuture(fut, fn) {
    return fut.then((res) => catchResult(res, fn));
  }

  /**
   *
   */
  function pipe(x, ...fns) {
    let res = x;

    for (let i = 0; i < fns.length; ++i) {
      res = fns[i](res);
    }

    return res;
  }

})();
