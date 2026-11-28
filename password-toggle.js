// Accessible show/hide controls for password inputs on authentication pages.
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('input[type="password"]').forEach(input=>{
    if(input.dataset.visibilityReady)return;
    input.dataset.visibilityReady='1';
    const wrap=document.createElement('span');wrap.className='password-field';
    input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const toggle=document.createElement('button');toggle.type='button';toggle.className='password-toggle';
    toggle.setAttribute('aria-label','Show password');toggle.setAttribute('aria-pressed','false');toggle.textContent='👁';
    toggle.addEventListener('click',()=>{
      const reveal=input.type==='password';input.type=reveal?'text':'password';
      toggle.setAttribute('aria-label',reveal?'Hide password':'Show password');
      toggle.setAttribute('aria-pressed',String(reveal));toggle.textContent=reveal?'🙈':'👁';
    });
    wrap.appendChild(toggle);
  });
});
