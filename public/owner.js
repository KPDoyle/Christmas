(()=>{
const $=id=>document.getElementById(id);
const forms=['signupForm','loginForm','forgotForm','resetForm','setupForm','dashboard'];
const show=(id,title)=>{for(const f of forms)$(f).hidden=f!==id;if(title)$('title').textContent=title};
const say=(text,tone)=>{const m=$('message');m.textContent=text||'';m.className=tone||''};
const hash=new URLSearchParams(location.hash.slice(1));
const resetToken=hash.get('reset');
if(location.hash)history.replaceState(null,'',location.pathname);

async function call(action,data){
  const r=await fetch('/api/owner?action='+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{})});
  const text=await r.text();
  if(!r.ok)throw Error(text.slice(0,200)||'Something went wrong.');
  try{return JSON.parse(text)}catch{return {}}
}
function busy(form,fn){
  return async e=>{
    e.preventDefault();
    const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
    try{await fn()}catch(err){say(err.message,'warning')}
    finally{buttons.forEach(b=>b.disabled=false)}
  };
}
function renderSender(s){
  const box=$('senderBox');
  $('testSender').hidden=$('disconnectSender').hidden=!s.connected;
  $('connectSender').textContent=s.connected?'Reconnect Microsoft 365 sender':'Connect Microsoft 365 sender';
  if(!s.configured){box.className='warning';box.textContent='Microsoft 365 is not configured on the server (MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID, MS_REDIRECT_URI, TOKEN_ENCRYPTION_KEY). Password-reset emails cannot be sent.';$('connectSender').hidden=true;return}
  $('connectSender').hidden=false;
  if(s.connected){box.className='ok';box.textContent='Connected as '+s.email+'. Password-reset emails are sent from this mailbox.';return}
  box.className='warning';
  box.textContent=s.needsReconnect
    ?'Microsoft 365 needs you to sign in again ('+(s.lastError||'token expired')+'). Password-reset emails cannot be sent until you reconnect.'
    :'The Microsoft 365 sender is not connected, so password-reset emails cannot be sent. Connect it and sign in as '+s.expectedEmail+'.';
}
async function load(){
  if(resetToken){show('resetForm','Reset your password');return}
  const r=await fetch('/api/owner?action=status',{credentials:'same-origin'});
  const s=await r.json();
  if(s.loggedIn){$('ownerEmail').textContent=s.email;$('senderSettings').hidden=!s.sender;if(s.sender)renderSender(s.sender);show('dashboard','Account settings');return}
  $('ownerSetup').hidden=!s.setupRequired;
  if(hash.has('signup')){show('signupForm','Create your organiser account');return}
  show('loginForm','Calendar Creator Sign-in');
}

$('ownerSetup').onclick=()=>show('setupForm','Set up the owner account');
$('signupLink').onclick=()=>show('signupForm','Create your organiser account');
$('signupBack').onclick=()=>show('loginForm','Calendar Creator Sign-in');
$('signupForm').onsubmit=busy($('signupForm'),async()=>{await call('signup',{email:$('signupEmail').value,password:$('signupPassword').value});location.assign('/#admin=session')});
$('loginForm').onsubmit=busy($('loginForm'),async()=>{await call('login',{email:$('loginEmail').value,password:$('loginPassword').value});location.assign('/#admin=session')});
$('showForgot').onclick=()=>{say('');$('forgotEmail').value=$('loginEmail').value;show('forgotForm','Reset your password')};
$('backToLogin').onclick=()=>{say('');show('loginForm','Calendar Creator Sign-in')};
$('forgotForm').onsubmit=busy($('forgotForm'),async()=>{const r=await call('forgot',{email:$('forgotEmail').value});say(r.message,'ok')});
$('resetForm').onsubmit=busy($('resetForm'),async()=>{
  if($('resetPassword').value!==$('resetConfirm').value)throw Error('The passwords do not match.');
  await call('reset',{token:resetToken,password:$('resetPassword').value});
  say('Your password has been changed and you are signed in.','ok');location.hash='';setTimeout(()=>location.reload(),900);
});
$('setupForm').onsubmit=busy($('setupForm'),async()=>{
  if($('setupPassword').value!==$('setupConfirm').value)throw Error('The passwords do not match.');
  await call('setup',{key:$('setupKey').value,password:$('setupPassword').value});
  say('Owner account created. Next, connect the Microsoft 365 sender so password resets can be emailed.','ok');await load();
});
$('logout').onclick=async()=>{await call('logout');try{sessionStorage.removeItem('calendarAdminHome')}catch{};say('Signed out.');await load()};
$('testSender').onclick=async()=>{try{const r=await call('ms-test');say('Test email sent to '+r.sentTo+'.','ok')}catch(e){say(e.message,'warning');load()}};
$('disconnectSender').onclick=async()=>{if(!confirm('Disconnect the Microsoft 365 sender? Password-reset emails will stop until you reconnect.'))return;await call('ms-disconnect');say('Disconnected.');await load()};
$('changeForm').onsubmit=busy($('changeForm'),async()=>{await call('change-password',{current:$('currentPassword').value,password:$('newPassword').value});$('changeForm').reset();say('Password changed. Other signed-in browsers have been signed out.','ok')});

if(hash.get('connected'))say('Microsoft 365 sender connected.','ok');
if(hash.get('error'))say(hash.get('error'),'warning');
load().catch(()=>say('Could not reach the server.','warning'));
})();
