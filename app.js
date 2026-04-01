// ══════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════
const SB_URL  = 'https://sxofyazhqzjzpsvblulj.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4b2Z5YXpocXpqenBzdmJsdWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzAwNzYsImV4cCI6MjA4OTYwNjA3Nn0.1CZ1-52kjF6C2bTdBimbE3MZR9IA3XPzTJ7X85u5ArM';
const SB_SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4b2Z5YXpocXpqenBzdmJsdWxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDAzMDA3NiwiZXhwIjoyMDg5NjA2MDc2fQ.Rg9RQvWzaIXdax3npNBDa3sGbENPmt_B5qovTiMt6PM';
const EDGE = SB_URL + '/functions/v1/ask-agent';
const sb = supabase.createClient(SB_URL, SB_ANON);

// ══════════════════════════════════════════════
// ADMIN — credenciais (hash SHA-256)
// ══════════════════════════════════════════════
const ADMIN_USER_HASH = 'f906e282a321d135e8fbf2632c39db96a28f3b5b1b6383267ae5b63d5ef7df47';
const ADMIN_PASS_HASH = '6a5b50bce55d917cb2a0c79d55dd8995452dce19b7a9e0ac6f319cf95cde26e3';

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
const S = {
  user: null, empresa: null,
  conversas: [], conversas_fin: [], lancamentos: [], contas_pagar: [], contas_receber: [], notas: [],
  notaExtraida: null, finTab: 'lancamentos'
};

const SYSTEM = `Você é o Agente DigitalMind — matriz central de inteligência empresarial.
Você integra os 3 pilares: Administrativo (6Ps, OKRs, gestão ágil), Marketing (META Ads, Kotler 5.0, ROI) e Financeiro (fluxo de caixa, DRE, indicadores).
Você tem acesso aos dados reais de todos os pilares incluindo CRM, Estoque e Metas. Analise de forma integrada, identifique conexões entre pilares e dê recomendações estratégicas completas.
Responda em português brasileiro. Seja direto, use os números reais, termine com 2-3 ações priorizadas numeradas.`;

const SYSTEM_ADM = `Você é o Agente Administrativo da plataforma DigitalMind.
Especialista em gestão empresarial: metodologia 6Ps, OKRs, estrutura organizacional, processos, delegação, liderança, cultura e PDCA.
Foco exclusivo em gestão — não responda sobre marketing ou finanças fora do contexto administrativo.
Responda em português brasileiro. Seja prático e objetivo.`;

const SYSTEM_MKT = `Você é o Agente de Marketing da plataforma DigitalMind.
Especialista em Marketing Digital e Philip Kotler (1.0 ao 5.0), META Ads, análise de performance e estratégia de conteúdo.
Você tem acesso aos dados reais das campanhas META, CRM de leads e contexto da empresa.
Foco exclusivo em marketing — não responda sobre gestão interna ou finanças fora do contexto de marketing.
Responda em português brasileiro. Use os dados reais nas análises. Termine com recomendações acionáveis.`;

// ══════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════
async function init() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) { S.user = session.user; await loadApp(); }
    else showAuth();
    sb.auth.onAuthStateChange(async (e, s) => {
      if (e==='SIGNED_IN'&&s) { S.user=s.user; await loadApp(); }
      if (e==='SIGNED_OUT') showAuth();
    });
  } catch(err) { showAuth(); }
}

function showAuth() {
  document.getElementById('loading').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('app-screen').classList.remove('visible');
}

let authTab = 'login';
function switchTab(t) {
  authTab=t;
  document.querySelectorAll('.auth-tab').forEach((el,i)=>el.classList.toggle('active',(i===0&&t==='login')||(i===1&&t==='register')));
  document.getElementById('auth-btn').textContent=t==='login'?'Entrar':'Criar conta';
  document.getElementById('auth-name-wrap').style.display=t==='register'?'block':'none';
  document.getElementById('auth-msg').style.display='none';
}

async function handleAuth() {
  const email=document.getElementById('auth-email').value.trim();
  const pw=document.getElementById('auth-password').value;
  const btn=document.getElementById('auth-btn');
  if(!email||!pw){showMsg('Preencha e-mail e senha.','error');return;}
  btn.disabled=true; btn.textContent='...';
  if(authTab==='login'){
    const {error}=await sb.auth.signInWithPassword({email,password:pw});
    if(error){showMsg('E-mail ou senha incorretos.','error');btn.disabled=false;btn.textContent='Entrar';}
  } else {
    const {error}=await sb.auth.signUp({email,password:pw});
    if(error){showMsg(error.message,'error');btn.disabled=false;btn.textContent='Criar conta';}
    else{showMsg('Conta criada! Verifique seu e-mail.','success');btn.disabled=false;btn.textContent='Criar conta';}
  }
}

function showMsg(t,c){const el=document.getElementById('auth-msg');el.textContent=t;el.className='auth-msg '+c;el.style.display='block';}
async function logout(){await sb.auth.signOut();S.user=null;S.empresa=null;S.conversas=[];}

// ══════════════════════════════════════════════
// APP LOAD
// ══════════════════════════════════════════════
async function loadApp() {
  if (!S.empresa) document.getElementById('loading').style.display='flex';
  document.getElementById('auth-screen').style.display='none';
  const {data:emp}=await sb.from('empresas').select('*').eq('user_id',S.user.id).single();
  S.empresa=emp;
  document.getElementById('loading').style.display='none';
  document.getElementById('app-screen').classList.add('visible');
  if(!emp){
    showPage('onboarding');
    document.getElementById('page-title').textContent='Bem-vindo!';
  } else {
    updateUI();
    await Promise.all([loadConversas(),loadConversasFin(),loadLancamentos(),loadContasPagar(),loadContasReceber(),loadNotas()]);
    // Carrega CRM e Metas em background (não bloqueantes)
    crmCarregar().catch(()=>{});
    metasCarregar().catch(()=>{});
    renderChecklists();
    renderAgenda();
    nav('inicio',document.querySelector('.nav-item'));
  }
}

function updateUI() {
  if(!S.empresa)return;
  document.getElementById('user-nome').textContent=S.empresa.nome;
  document.getElementById('user-email').textContent=S.user.email;
  document.getElementById('sc-adm').textContent=S.empresa.score_adm||0;
  document.getElementById('sc-mkt').textContent=S.empresa.score_mkt||0;
  document.getElementById('sc-fin').textContent=S.empresa.score_fin||0;
  document.getElementById('era-desc').textContent='Era '+(S.empresa.era_marketing||'1.0')+' de marketing';
  // Atualiza tela inicial
  const nomeEl=document.getElementById('inicio-nome');
  if(nomeEl)nomeEl.textContent=S.empresa.nome||'empresa';
  const subEl=document.getElementById('inicio-sub');
  if(subEl)subEl.textContent=(S.empresa.setor||'Hub Empresarial')+' — seus 3 pilares de crescimento';
  const topEl=document.getElementById('topbar-empresa');
  if(topEl)topEl.textContent=S.empresa.nome||'';
}

function initInicio(){
  updateUI();
  const el=document.getElementById('chat-dash');if(!el||el.innerHTML!=='')return;
  appendSpecialMsg('agent',`Olá! Sou o **Agente DigitalMind**.\n\nTenho acesso completo aos seus **3 pilares**:\n\n🏛️ **Administrativo** — processos, OKRs, metodologia 6Ps\n📡 **Marketing** — META, campanhas, conteúdo, ROI\n💰 **Financeiro** — fluxo de caixa, DRE, indicadores\n\nComo posso ajudar hoje?`,'chat-dash');
}

async function salvarOnboarding() {
  const nome=document.getElementById('ob-nome').value.trim();
  if(!nome){alert('Informe o nome da empresa.');return;}
  const {data}=await sb.from('empresas').insert({
    user_id:S.user.id, nome, setor:document.getElementById('ob-setor').value,
    responsavel:document.getElementById('ob-resp').value,
    descricao:document.getElementById('ob-desc').value,
    fase:document.getElementById('ob-fase').value,
    score_adm:0,score_mkt:0,score_fin:0,era_marketing:'1.0'
  }).select().single();
  if(data){S.empresa=data;updateUI();await Promise.all([loadConversas(),loadLancamentos(),loadContasPagar(),loadContasReceber()]);renderChecklists();nav('inicio',document.querySelector('.nav-item'));}
}

function nav(page, el) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  showPage(page);
  if(el)el.classList.add('active');
  const titles={inicio:'Início',agente:'Agente IA',agenda:'Agendamento',adm:'Administrativo',mkt:'Marketing',financeiro:'Financeiro',onboarding:'Bem-vindo!',cronograma:'Cronograma',dashboard:'Início'};
  document.getElementById('page-title').textContent=titles[page]||page;
  if(page==='adm'){setTimeout(()=>{initAdmChat();loadSixps();},100);}
  if(page==='mkt'){initMktPage();document.querySelector('.content').scrollTop=0;}
  if(page==='cronograma'){setTimeout(initCronograma,100);}
  if(page==='inicio'||page==='dashboard'){setTimeout(initInicio,100);}
  if(page==='financeiro'){syncFinanceiro();setTimeout(()=>showFinTab('dashboard',document.getElementById('ftab-dashboard')),100);}
  if(page==='agenda')renderAgenda();
  if(page==='whatsapp'){setTimeout(()=>{waCarregarConfig();waTab('visao',document.getElementById('watab-visao'));},100);}
}

function showPage(p){const el=document.getElementById('page-'+p);if(el)el.classList.add('active');const c=document.querySelector('.content');if(c)c.scrollTop=0;}

function openModal(id){document.getElementById(id).style.display='flex';}
function closeModal(id){document.getElementById(id).style.display='none';}

// ══════════════════════════════════════════════
// AGENT CHAT
// ══════════════════════════════════════════════
async function loadConversas() {
  const {data}=await sb.from('conversas').select('*').eq('user_id',S.user.id).order('created_at',{ascending:true}).limit(50);
  S.conversas=data||[];
  renderConversas();
}

function renderConversas() {
  const n=S.conversas.length;
  const badge='memória: '+n+' msg'+(n!==1?'s':'');
  ['mem-badge','mem-badge-full'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=badge;});
  if(document.getElementById('mem-count'))document.getElementById('mem-count').textContent=badge;
  ['chat-dash','chat-full'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.innerHTML='';
    if(n===0){appendM('agent','Olá! Sou o Agente DigitalMind. Estou aqui para ajudar **'+(S.empresa?.nome||'sua empresa')+'** a crescer pelos 3 pilares. Como posso ajudar?',id);}
    else{S.conversas.slice(-20).forEach(m=>appendM(m.role==='user'?'user':'agent',m.content,id));}
    el.scrollTop=99999;
  });
}

async function callAgent(userMsg, chatId, btnId, extraCtx) {
  const btn=document.getElementById(btnId);
  if(btn)btn.disabled=true;
  await sb.from('conversas').insert({user_id:S.user.id,role:'user',content:userMsg});
  S.conversas.push({role:'user',content:userMsg});
  const lid='l-'+Date.now();
  document.getElementById(chatId)?.insertAdjacentHTML('beforeend',`<div class="msg agent" id="${lid}"><div class="msg-av">✈</div><div class="msg-bub"><div class="typing"><span></span><span></span><span></span></div></div></div>`);
  document.getElementById(chatId).scrollTop=99999;
  try {
    const messages=S.conversas.slice(-30).map(c=>({role:c.role==='assistant'?'assistant':'user',content:c.content}));
    // Contexto completo dos 3 pilares
    const clientCtx = buildFullContext() + (extraCtx ? '\n'+extraCtx : '');
    const res=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},body:JSON.stringify({messages,clientContext:clientCtx,systemPrompt:SYSTEM})});
    document.getElementById(lid)?.remove();
    const data=await res.json();
    const reply=data.reply||'Erro ao obter resposta.';
    await sb.from('conversas').insert({user_id:S.user.id,role:'assistant',content:reply});
    S.conversas.push({role:'assistant',content:reply});
    appendM('agent',reply,chatId);
    const badge='memória: '+S.conversas.length+' msgs';
    ['mem-badge','mem-badge-full'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=badge;});
  } catch(e) {
    document.getElementById(lid)?.remove();
    appendM('agent','❌ Erro: '+e.message,chatId);
  } finally {if(btn)btn.disabled=false;}
}

function appendM(role,text,id) {
  const lbl=role==='agent'?'DM':'👤';
  const fmt=text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>');
  document.getElementById(id)?.insertAdjacentHTML('beforeend',`<div class="msg ${role==='agent'?'agent':'user'}"><div class="msg-av">${lbl}</div><div class="msg-bub">${fmt}</div></div>`);
  const el=document.getElementById(id);if(el)el.scrollTop=el.scrollHeight;
}

async function sendMsg(mode) {
  const inputId=mode==='dash'?'chat-input-dash':'chat-input-full';
  const chatId=mode==='dash'?'chat-dash':'chat-full';
  const btnId=mode==='dash'?'send-dash':'send-full';
  const input=document.getElementById(inputId);
  const text=input.value.trim();if(!text)return;
  appendM('user',text,chatId);
  input.value='';input.style.height='auto';
  await callAgent(text,chatId,btnId);
}

function sendQ(t){document.getElementById('chat-input-dash').value=t;sendMsg('dash');}
function sendQF(t){document.getElementById('chat-input-full').value=t;sendMsg('full');}

// ══════════════════════════════════════════════
// FINANCEIRO
// ══════════════════════════════════════════════
const fmt=(v)=>'R$ '+Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2});
const fmtD=(d)=>d?.split('-').reverse().join('/')||'—';

async function loadLancamentos(){const {data}=await sb.from('lancamentos').select('*').eq('user_id',S.user.id).order('data',{ascending:false});S.lancamentos=data||[];return S.lancamentos;}

async function salvarLanc(){
  const tipo=document.getElementById('l-tipo').value;
  const desc=document.getElementById('l-desc').value.trim();
  const val=parseFloat(document.getElementById('l-val').value);
  const data=document.getElementById('l-data').value;
  const nota=document.getElementById('l-nota').value.trim();
  const cat=document.getElementById('l-cat').value;
  if(!desc||isNaN(val)||val<=0||!data){alert('Preencha todos os campos.');return;}
  const {data:row}=await sb.from('lancamentos').insert({user_id:S.user.id,tipo,descricao:desc,valor:val,data,nota,categoria:cat}).select().single();
  if(row){S.lancamentos.unshift(row);renderLanc();renderMetricas();}
  closeModal('modal-lanc');
  document.getElementById('l-desc').value='';document.getElementById('l-val').value='';document.getElementById('l-nota').value='';
}

function renderLanc(){
  const tb=document.getElementById('tb-lanc');
  if(!S.lancamentos.length){tb.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Nenhum lançamento</td></tr>';return;}
  tb.innerHTML=S.lancamentos.map(l=>`<tr>
    <td>${fmtD(l.data)}</td>
    <td>${l.descricao}</td>
    <td style="color:var(--muted);font-size:12px">${l.categoria||''}</td>
    <td><span class="tag ${l.tipo}">${l.tipo==='entrada'?'Entrada':'Saída'}</span></td>
    <td style="font-weight:500;color:${l.tipo==='entrada'?'var(--success)':'var(--danger)'}">${l.tipo==='entrada'?'+':'-'} ${fmt(l.valor)}</td>
    <td style="color:var(--muted);font-size:12px">${l.nota||'—'}</td>
    <td style="display:flex;gap:4px">
      <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px" onclick="editarLanc('${l.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px;color:var(--danger)" onclick="deletarLanc('${l.id}')">🗑</button>
    </td>
  </tr>`).join('');
}

async function deletarLanc(id){
  if(!confirm('Excluir este lançamento?'))return;
  await sb.from('lancamentos').delete().eq('id',id);
  S.lancamentos=S.lancamentos.filter(l=>l.id!==id);
  renderLanc();renderMetricas();renderDRE();
}

function editarLanc(id){
  const l=S.lancamentos.find(x=>x.id===id);if(!l)return;
  document.getElementById('l-desc').value=l.descricao;
  document.getElementById('l-val').value=l.valor;
  document.getElementById('l-tipo').value=l.tipo;
  document.getElementById('l-cat').value=l.categoria||'';
  document.getElementById('l-data').value=l.data;
  document.getElementById('l-nota').value=l.nota||'';
  const modal=document.getElementById('modal-lanc');
  if(modal){
    modal.dataset.editId=id;
    const btn=modal.querySelector('button[onclick="salvarLanc()"]');
    if(btn){btn.textContent='Atualizar';btn.setAttribute('onclick',`salvarLancEdit('${id}')`);}
    openModal('modal-lanc');
  }
}

async function salvarLancEdit(id){
  const desc=document.getElementById('l-desc').value.trim();
  const val=parseFloat(document.getElementById('l-val').value);
  const tipo=document.getElementById('l-tipo').value;
  const cat=document.getElementById('l-cat').value;
  const data=document.getElementById('l-data').value;
  const nota=document.getElementById('l-nota').value.trim();
  if(!desc||isNaN(val)||val<=0||!data){alert('Preencha todos os campos.');return;}
  await sb.from('lancamentos').update({descricao:desc,valor:val,tipo,categoria:cat,data,nota}).eq('id',id);
  const idx=S.lancamentos.findIndex(l=>l.id===id);
  if(idx>=0)S.lancamentos[idx]={...S.lancamentos[idx],descricao:desc,valor:val,tipo,categoria:cat,data,nota};
  renderLanc();renderMetricas();renderDRE();closeModal('modal-lanc');
}

function renderPagar(){
  const tb=document.getElementById('tb-pagar');
  if(!S.contas_pagar.length){tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Nenhuma conta</td></tr>';return;}
  const hoje=new Date().toISOString().split('T')[0];
  tb.innerHTML=S.contas_pagar.map(c=>{
    let st=c.status;if(st==='pendente'&&c.vencimento<hoje)st='vencido';
    return`<tr>
      <td style="color:${c.vencimento<hoje&&st!=='pago'?'var(--danger)':''}">${fmtD(c.vencimento)}</td>
      <td>${c.descricao}</td>
      <td style="color:var(--muted);font-size:12px">${c.fornecedor||'—'}</td>
      <td style="font-weight:500">${fmt(c.valor)}</td>
      <td><span class="tag ${st}">${st}</span></td>
      <td style="display:flex;gap:4px;flex-wrap:wrap">
        ${c.status==='pendente'?`<button class="btn btn-success btn-sm" style="font-size:11px" onclick="marcarPago('${c.id}')">✅ Pagar</button>`:''}
        <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px" onclick="editarConta('pagar','${c.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px;color:var(--danger)" onclick="deletarConta('pagar','${c.id}')">🗑</button>
      </td>
    </tr>`;}).join('');
}

async function deletarConta(tipo,id){
  if(!confirm('Excluir esta conta?'))return;
  const tabela=tipo==='pagar'?'contas_pagar':'contas_receber';
  await sb.from(tabela).delete().eq('id',id);
  if(tipo==='pagar'){S.contas_pagar=S.contas_pagar.filter(c=>c.id!==id);renderPagar();}
  else{S.contas_receber=S.contas_receber.filter(c=>c.id!==id);renderReceber();}
  renderMetricas();
}

async function editarConta(tipo,id){
  const lista=tipo==='pagar'?S.contas_pagar:S.contas_receber;
  const c=lista.find(x=>x.id===id);if(!c)return;
  if(tipo==='pagar'){
    document.getElementById('p-desc').value=c.descricao;
    document.getElementById('p-forn').value=c.fornecedor||'';
    document.getElementById('p-val').value=c.valor;
    document.getElementById('p-venc').value=c.vencimento;
    document.getElementById('p-cat').value=c.categoria||'';
    const modal=document.getElementById('modal-pagar');
    if(modal){modal.dataset.editId=id;openModal('modal-pagar');}
  } else {
    document.getElementById('r-desc').value=c.descricao;
    document.getElementById('r-cli').value=c.cliente||'';
    document.getElementById('r-val').value=c.valor;
    document.getElementById('r-venc').value=c.vencimento;
    const modal=document.getElementById('modal-receber');
    if(modal){modal.dataset.editId=id;openModal('modal-receber');}
  }
}

function renderReceber(){
  const tb=document.getElementById('tb-receber');
  if(!S.contas_receber.length){tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Nenhuma conta</td></tr>';return;}
  const hoje=new Date().toISOString().split('T')[0];
  tb.innerHTML=S.contas_receber.map(c=>{
    let st=c.status;if(st==='pendente'&&c.vencimento<hoje)st='vencido';
    return`<tr>
      <td style="color:${c.vencimento<hoje&&st!=='recebido'?'var(--danger)':''}">${fmtD(c.vencimento)}</td>
      <td>${c.descricao}</td>
      <td style="color:var(--muted);font-size:12px">${c.cliente||'—'}</td>
      <td style="font-weight:500;color:var(--success)">${fmt(c.valor)}</td>
      <td><span class="tag ${st}">${st}</span></td>
      <td style="display:flex;gap:4px;flex-wrap:wrap">
        ${c.status==='pendente'?`<button class="btn btn-primary btn-sm" style="font-size:11px" onclick="marcarRecebido('${c.id}')">💰 Receber</button>`:''}
        <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px" onclick="editarConta('receber','${c.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px;color:var(--danger)" onclick="deletarConta('receber','${c.id}')">🗑</button>
      </td>
    </tr>`;}).join('');
}

function renderDashFin(){
  const ent=S.lancamentos.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const sai=S.lancamentos.filter(l=>l.tipo==='saida').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const lucro=ent-sai;
  const margem=ent>0?((lucro/ent)*100).toFixed(1):0;
  const hoje=new Date().toISOString().split('T')[0];

  // DRE mini
  const dre=document.getElementById('dash-dre-mini');
  if(dre) dre.innerHTML=`
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--muted);font-size:13px">Receita bruta</span>
      <span style="color:var(--success);font-weight:600">${fmt(ent)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--muted);font-size:13px">(−) Despesas totais</span>
      <span style="color:var(--danger);font-weight:600">${fmt(sai)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid var(--border2)">
      <span style="font-weight:700">Lucro líquido</span>
      <span style="font-weight:700;font-size:18px;color:${lucro>=0?'var(--success)':'var(--danger)'}">${fmt(lucro)}</span>
    </div>
    <div style="display:flex;justify-content:space-between">
      <span style="color:var(--muted);font-size:12px">Margem líquida</span>
      <span style="font-size:12px;color:${margem>=0?'var(--success)':'var(--danger)'}">${margem}%</span>
    </div>`;

  // Indicadores
  const pe=document.getElementById('dash-pe');if(pe)pe.textContent=MZ?.p6_ponto_equilibrio?fmt(MZ.p6_ponto_equilibrio):'—';
  const marg=document.getElementById('dash-margem');if(marg){marg.textContent=margem+'%';marg.style.color=margem>=0?'var(--success)':'var(--danger)';}
  const inadimp=S.contas_receber.filter(c=>c.status==='pendente'&&c.vencimento<hoje).reduce((s,c)=>s+parseFloat(c.valor||0),0);
  const inadEl=document.getElementById('dash-inadimp');if(inadEl)inadEl.textContent=fmt(inadimp);
  const proj=ent>0?(ent/new Date().getDate()*30).toFixed(0):0;
  const projEl=document.getElementById('dash-proj');if(projEl)projEl.textContent=fmt(proj);

  // Próximos vencimentos
  const vencs=document.getElementById('dash-vencimentos');
  if(vencs){
    const em7=new Date(Date.now()+7*86400000).toISOString().split('T')[0];
    const prox=S.contas_pagar.filter(c=>c.status==='pendente'&&c.vencimento<=em7).slice(0,4);
    vencs.innerHTML=prox.length?prox.map(c=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">
        <div><div style="font-size:12px">${c.descricao}</div><div style="font-size:10px;color:var(--muted)">${fmtD(c.vencimento)}</div></div>
        <span style="font-size:12px;font-weight:600;color:var(--danger)">${fmt(c.valor)}</span>
      </div>`).join(''):'<div style="color:var(--muted);font-size:12px">Nenhum vencimento próximo</div>';
  }

  // Entradas previstas
  const entPrev=document.getElementById('dash-entradas-prev');
  if(entPrev){
    const em30=new Date(Date.now()+30*86400000).toISOString().split('T')[0];
    const prox=S.contas_receber.filter(c=>c.status==='pendente'&&c.vencimento<=em30).slice(0,4);
    entPrev.innerHTML=prox.length?prox.map(c=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">
        <div><div style="font-size:12px">${c.descricao}</div><div style="font-size:10px;color:var(--muted)">${c.cliente||'—'} · ${fmtD(c.vencimento)}</div></div>
        <span style="font-size:12px;font-weight:600;color:var(--success)">${fmt(c.valor)}</span>
      </div>`).join(''):'<div style="color:var(--muted);font-size:12px">Nenhuma entrada prevista</div>';
  }

  // Charts dashboard
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun'];
  const now=new Date();
  const entMes=meses.map((_,i)=>{const m=new Date(now.getFullYear(),now.getMonth()-5+i,1);return S.lancamentos.filter(l=>{const d=new Date(l.data);return l.tipo==='entrada'&&d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear();}).reduce((s,l)=>s+parseFloat(l.valor),0);});
  const saiMes=meses.map((_,i)=>{const m=new Date(now.getFullYear(),now.getMonth()-5+i,1);return S.lancamentos.filter(l=>{const d=new Date(l.data);return l.tipo==='saida'&&d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear();}).reduce((s,l)=>s+parseFloat(l.valor),0);});
  const cf=document.getElementById('chart-dash-fluxo');
  if(cf){if(charts.dashFluxo)charts.dashFluxo.destroy();charts.dashFluxo=new Chart(cf,{type:'bar',data:{labels:meses,datasets:[{label:'Entradas',data:entMes,backgroundColor:'rgba(16,185,129,.5)'},{label:'Saídas',data:saiMes,backgroundColor:'rgba(239,68,68,.5)'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8080a0',font:{size:10}}},y:{ticks:{color:'#8080a0',font:{size:10},callback:v=>'R$'+v.toLocaleString('pt-BR')}}}}});}
  const cats={};S.lancamentos.filter(l=>l.tipo==='saida').forEach(l=>{const c=l.categoria||'outro';cats[c]=(cats[c]||0)+parseFloat(l.valor);});
  const cc=document.getElementById('chart-dash-cat');
  if(cc&&Object.keys(cats).length){if(charts.dashCat)charts.dashCat.destroy();charts.dashCat=new Chart(cc,{type:'doughnut',data:{labels:Object.keys(cats),datasets:[{data:Object.values(cats),backgroundColor:['#3b82f6','#a78bfa','#f59e0b','#ef4444','#10b981','#06b6d4']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#8080a0',boxWidth:10,font:{size:10}}}}}});}
}

async function loadContasPagar(){const {data}=await sb.from('contas_pagar').select('*').eq('user_id',S.user.id).order('vencimento',{ascending:true});S.contas_pagar=data||[];checkVencimentos();}

async function salvarPagar(){
  const desc=document.getElementById('p-desc').value.trim();
  const forn=document.getElementById('p-forn').value.trim();
  const val=parseFloat(document.getElementById('p-val').value);
  const venc=document.getElementById('p-venc').value;
  const cat=document.getElementById('p-cat').value;
  if(!desc||isNaN(val)||val<=0||!venc){alert('Preencha todos os campos.');return;}
  const {data:row}=await sb.from('contas_pagar').insert({user_id:S.user.id,descricao:desc,fornecedor:forn,valor:val,vencimento:venc,categoria:cat,status:'pendente'}).select().single();
  if(row){S.contas_pagar.push(row);S.contas_pagar.sort((a,b)=>a.vencimento.localeCompare(b.vencimento));renderPagar();renderMetricas();}
  closeModal('modal-pagar');
}

async function marcarPago(id){
  await sb.from('contas_pagar').update({status:'pago'}).eq('id',id);
  const item=S.contas_pagar.find(x=>x.id===id);
  if(item){item.status='pago';await sb.from('lancamentos').insert({user_id:S.user.id,tipo:'saida',descricao:item.descricao,valor:item.valor,data:new Date().toISOString().split('T')[0],categoria:item.categoria});S.lancamentos.unshift({tipo:'saida',descricao:item.descricao,valor:item.valor,data:new Date().toISOString().split('T')[0],categoria:item.categoria});}
  renderPagar();renderLanc();renderMetricas();
}

// renderPagar redefinida acima com CRUD

async function loadContasReceber(){const {data}=await sb.from('contas_receber').select('*').eq('user_id',S.user.id).order('vencimento',{ascending:true});S.contas_receber=data||[];}

async function salvarReceber(){
  const desc=document.getElementById('r-desc').value.trim();
  const cli=document.getElementById('r-cli').value.trim();
  const val=parseFloat(document.getElementById('r-val').value);
  const venc=document.getElementById('r-venc').value;
  if(!desc||isNaN(val)||val<=0||!venc){alert('Preencha todos os campos.');return;}
  const {data:row}=await sb.from('contas_receber').insert({user_id:S.user.id,descricao:desc,cliente:cli,valor:val,vencimento:venc,status:'pendente'}).select().single();
  if(row){S.contas_receber.push(row);renderReceber();renderMetricas();}
  closeModal('modal-receber');
}

async function marcarRecebido(id){
  await sb.from('contas_receber').update({status:'recebido'}).eq('id',id);
  const item=S.contas_receber.find(x=>x.id===id);
  if(item){item.status='recebido';await sb.from('lancamentos').insert({user_id:S.user.id,tipo:'entrada',descricao:item.descricao,valor:item.valor,data:new Date().toISOString().split('T')[0],categoria:'vendas'});S.lancamentos.unshift({tipo:'entrada',descricao:item.descricao,valor:item.valor,data:new Date().toISOString().split('T')[0],categoria:'vendas'});}
  renderReceber();renderLanc();renderMetricas();
}

// renderReceber redefinida acima com CRUD

function renderMetricas(){
  const ent=S.lancamentos.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const sai=S.lancamentos.filter(l=>l.tipo==='saida').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const saldo=ent-sai;
  const hoje=new Date().toISOString().split('T')[0];
  const em7=new Date(Date.now()+7*86400000).toISOString().split('T')[0];
  const vencer=S.contas_pagar.filter(c=>c.status==='pendente'&&c.vencimento>=hoje&&c.vencimento<=em7).reduce((s,c)=>s+parseFloat(c.valor||0),0);
  const mRec=document.getElementById('m-rec');const mDesp=document.getElementById('m-desp');const mSaldo=document.getElementById('m-saldo');const mSaldoD=document.getElementById('m-saldo-d');const mVencer=document.getElementById('m-vencer');
  if(mRec)mRec.textContent=fmt(ent);if(mDesp)mDesp.textContent=fmt(sai);
  if(mSaldo){mSaldo.textContent=fmt(saldo);mSaldo.className='metric-value '+(saldo>=0?'positive':'negative');}
  if(mSaldoD)mSaldoD.textContent=S.lancamentos.length+' lançamento(s)';
  if(mVencer)mVencer.textContent=fmt(vencer);
  checkVencimentos();
}

async function syncFinanceiro(){
  const [l,p,r]=await Promise.all([
    sb.from('lancamentos').select('*').eq('user_id',S.user.id).order('data',{ascending:false}),
    sb.from('contas_pagar').select('*').eq('user_id',S.user.id).order('vencimento',{ascending:true}),
    sb.from('contas_receber').select('*').eq('user_id',S.user.id).order('vencimento',{ascending:true})
  ]);
  S.lancamentos=l.data||[];S.contas_pagar=p.data||[];S.contas_receber=r.data||[];
  renderMetricas();renderLanc();renderPagar();renderReceber();
  if(S.finTab==='dashboard')renderDashFin();
}

function checkVencimentos(){
  const wrap=document.getElementById('alertas-wrap');if(!wrap)return;
  const hoje=new Date().toISOString().split('T')[0];
  const vencidas=S.contas_pagar.filter(c=>c.status==='pendente'&&c.vencimento<hoje);
  const proximas=S.contas_pagar.filter(c=>{const d=new Date(c.vencimento);const agora=new Date();const diff=(d-agora)/(86400000);return c.status==='pendente'&&diff>=0&&diff<=3;});
  let html='';
  vencidas.forEach(c=>{html+=`<div class="alert-row"><div class="dot"></div><strong>VENCIDA:</strong> ${c.descricao} — ${fmt(c.valor)} (${fmtD(c.vencimento)})</div>`;});
  proximas.forEach(c=>{html+=`<div class="warn-row"><div class="dot"></div><strong>Vence em breve:</strong> ${c.descricao} — ${fmt(c.valor)} (${fmtD(c.vencimento)})</div>`;});
  wrap.innerHTML=html;
}

async function loadNotas(){const {data}=await sb.from('notas_fiscais').select('*').eq('user_id',S.user.id).order('created_at',{ascending:false});S.notas=data||[];}

async function handleNota(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async(e)=>{
    const base64=e.target.result.split(',')[1];
    const preview=document.getElementById('nota-preview');preview.src=e.target.result;preview.style.display='block';
    const status=document.getElementById('nota-status');status.innerHTML='<span style="color:var(--accent)">⏳ Analisando nota fiscal com IA...</span>';
    document.getElementById('nota-extraida').innerHTML='<div class="typing"><span></span><span></span><span></span></div>';
    try {
      const res=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},body:JSON.stringify({messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:file.type,data:base64}},{type:'text',text:'Extraia os dados desta nota fiscal e retorne APENAS um JSON válido com: fornecedor, cnpj, valor (number), data (YYYY-MM-DD), categoria (fornecedor/servicos/fixo/imposto/outro), descricao. Sem texto adicional.'}]}],systemPrompt:'Extraia dados de nota fiscal e retorne apenas JSON.'})});
      const data=await res.json();
      const txt=(data.reply||'').replace(/```json|```/g,'').trim();
      const nota=JSON.parse(txt);
      S.notaExtraida=nota;
      document.getElementById('nota-extraida').innerHTML=`<div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Fornecedor</span><span style="font-weight:500">${nota.fornecedor||'—'}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">CNPJ</span><span>${nota.cnpj||'—'}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Valor</span><span style="font-weight:700;color:var(--fin)">${fmt(nota.valor||0)}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Data</span><span>${nota.data?fmtD(nota.data):'—'}</span></div></div>`;
      document.getElementById('nota-btn-wrap').style.display='block';
      status.innerHTML='<span style="color:var(--success)">✓ Dados extraídos!</span>';
    } catch(e){status.innerHTML='<span style="color:var(--danger)">❌ Erro: '+e.message+'</span>';}
  };
  reader.readAsDataURL(file);
}

async function confirmarNota(){
  if(!S.notaExtraida)return;
  const n=S.notaExtraida;
  await sb.from('notas_fiscais').insert({user_id:S.user.id,fornecedor:n.fornecedor,cnpj:n.cnpj,valor:n.valor,data_emissao:n.data,categoria:n.categoria,processada:true});
  const {data:lancRow}=await sb.from('lancamentos').insert({user_id:S.user.id,tipo:'saida',descricao:n.descricao||('NF - '+n.fornecedor),valor:n.valor,data:n.data||new Date().toISOString().split('T')[0],categoria:n.categoria}).select().single();
  if(lancRow)S.lancamentos.unshift(lancRow);
  renderLanc();renderMetricas();
  document.getElementById('nota-extraida').innerHTML='<p style="font-size:13px;color:var(--success)">✓ Lançamento registrado!</p>';
  document.getElementById('nota-btn-wrap').style.display='none';
  S.notaExtraida=null;
}

function renderNotas(){
  const tb=document.getElementById('tb-notas');
  if(!S.notas.length){tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">Nenhuma nota</td></tr>';return;}
  tb.innerHTML=S.notas.map(n=>`<tr><td>${fmtD(n.data_emissao)}</td><td>${n.fornecedor||'—'}</td><td style="color:var(--muted);font-size:12px">${n.cnpj||'—'}</td><td style="font-weight:500">${fmt(n.valor||0)}</td><td><span class="tag ${n.processada?'entrada':'pendente'}">${n.processada?'processada':'pendente'}</span></td></tr>`).join('');
}

function renderDRE(){
  const ent=S.lancamentos.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+parseFloat(l.valor),0);
  const sai=S.lancamentos.filter(l=>l.tipo==='saida').reduce((s,l)=>s+parseFloat(l.valor),0);
  const lucro=ent-sai;const margem=ent>0?((lucro/ent)*100).toFixed(1):0;
  const wrap=document.getElementById('dre-content');if(!wrap)return;
  wrap.innerHTML=`<div style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted)">Receita bruta</span><span style="color:var(--success);font-weight:600">${fmt(ent)}</span></div><div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted)">(−) Despesas totais</span><span style="color:var(--danger);font-weight:600">${fmt(sai)}</span></div><div style="display:flex;justify-content:space-between;padding:12px 0;border-top:2px solid var(--border2)"><span style="font-weight:700">Lucro líquido</span><span style="font-weight:700;font-size:18px;color:${lucro>=0?'var(--success)':'var(--danger)'}">${fmt(lucro)}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:13px">Margem líquida</span><span style="font-size:13px">${margem}%</span></div></div>`;
}

function exportDRE(){
  const ent=S.lancamentos.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+parseFloat(l.valor),0);
  const sai=S.lancamentos.filter(l=>l.tipo==='saida').reduce((s,l)=>s+parseFloat(l.valor),0);
  const lucro=ent-sai;
  const txt=`DRE — ${S.empresa?.nome||'DigitalMind'}\n${'='.repeat(50)}\nReceita:  ${fmt(ent)}\nDespesas: ${fmt(sai)}\n${'-'.repeat(36)}\nLucro:    ${fmt(lucro)}\nMargem:   ${((lucro/ent)*100).toFixed(1)}%\n\nGerado: ${new Date().toLocaleString('pt-BR')}`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));a.download='DRE.txt';a.click();
}

let charts={};
function renderCharts(){
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun'];
  const now=new Date();
  const entMes=meses.map((_,i)=>{const m=new Date(now.getFullYear(),now.getMonth()-5+i,1);return S.lancamentos.filter(l=>{const d=new Date(l.data);return l.tipo==='entrada'&&d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear();}).reduce((s,l)=>s+parseFloat(l.valor),0);});
  const saiMes=meses.map((_,i)=>{const m=new Date(now.getFullYear(),now.getMonth()-5+i,1);return S.lancamentos.filter(l=>{const d=new Date(l.data);return l.tipo==='saida'&&d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear();}).reduce((s,l)=>s+parseFloat(l.valor),0);});
  const c1=document.getElementById('chart-fluxo');
  if(charts.fluxo)charts.fluxo.destroy();
  charts.fluxo=new Chart(c1,{type:'bar',data:{labels:meses,datasets:[{label:'Entradas',data:entMes,backgroundColor:'rgba(46,204,113,.6)'},{label:'Saídas',data:saiMes,backgroundColor:'rgba(255,107,107,.6)'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8080a0'}},y:{ticks:{color:'#8080a0',callback:v=>'R$'+v}}}}});
  const cats={};S.lancamentos.filter(l=>l.tipo==='saida').forEach(l=>{const c=l.categoria||'outro';cats[c]=(cats[c]||0)+parseFloat(l.valor);});
  const c2=document.getElementById('chart-cat');
  if(charts.cat)charts.cat.destroy();
  if(Object.keys(cats).length){charts.cat=new Chart(c2,{type:'doughnut',data:{labels:Object.keys(cats),datasets:[{data:Object.values(cats),backgroundColor:['#7c6dfa','#4ecdc4','#f7b731','#ff6b6b','#2ecc71','#e056fd']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#8080a0',boxWidth:12}}}}});}
}

// ══════════════════════════════════════════════
// AGENTE FINANCEIRO
// ══════════════════════════════════════════════
async function loadConversasFin(){
  const {data}=await sb.from('conversas_financeiro').select('*').eq('user_id',S.user.id).order('created_at',{ascending:true}).limit(60);
  S.conversas_fin=data||[];renderConversasFin();
}

function renderConversasFin(){
  const el=document.getElementById('chat-fin');if(!el)return;
  el.innerHTML='';
  const hoje=new Date().toLocaleDateString('pt-BR');
  const ent=S.lancamentos.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const sai=S.lancamentos.filter(l=>l.tipo==='saida').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  if(!S.conversas_fin.length){
    appendMFin('agent',`Olá! Hoje é ${hoje}.\n\n📊 **Resumo atual:**\n• Receitas: ${fmt(ent)} | Despesas: ${fmt(sai)} | Saldo: ${fmt(ent-sai)}\n\nSou seu Assistente Financeiro. Registre movimentações por texto ou faça perguntas!`);
  } else {S.conversas_fin.slice(-30).forEach(m=>appendMFin(m.role==='user'?'user':'agent',m.content));}
  el.scrollTop=99999;
}

function initFinChat(){renderConversasFin();syncFinanceiro();}

function detectarMovimentacao(text) {
  const t=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const kwEntrada=['recebi','vendi','venda','faturei','receita','ganhei','aporte','depositei','entrou','cliente pagou'];
  const kwSaida=['paguei','despesa','saida','comprei','gastei','aluguel','salario','conta','boleto','imposto','taxa','fornecedor','custo'];
  const ehEntrada=kwEntrada.some(k=>t.includes(k));
  const ehSaida=kwSaida.some(k=>t.includes(k));
  if(!ehEntrada&&!ehSaida)return null;
  let valor=0;
  const m1=text.match(/R\$\s*([\d.,]+)/i);const m2=text.match(/(\d+(?:[.,]\d{2})?)\s*(?:reais|real)/i);const m3=text.match(/(\d+(?:[.,]\d+)?)/);
  const raw=m1?.[1]||m2?.[1]||m3?.[1]||'0';
  valor=parseFloat(raw.replace(/\./g,'').replace(',','.'));
  if(isNaN(valor)||valor<=0)return null;
  let categoria='outro';
  if(t.includes('venda')||t.includes('client'))categoria='vendas';
  else if(t.includes('servic'))categoria='servicos';
  else if(t.includes('aporte')||t.includes('invest'))categoria='aporte';
  else if(t.includes('fornecedor')||t.includes('compra'))categoria='fornecedor';
  else if(t.includes('salario')||t.includes('funcionario'))categoria='pessoal';
  else if(t.includes('aluguel')||t.includes('fixo'))categoria='fixo';
  else if(t.includes('imposto')||t.includes('taxa'))categoria='imposto';
  return{tipo:ehEntrada?'entrada':'saida',valor,categoria,descricao:text.substring(0,60),data:new Date().toISOString().split('T')[0]};
}

async function registrarLancamentoFin(lanc){
  try {
    const {data:{session}}=await sb.auth.getSession();
    if(!session)return false;
    const {data:row,error}=await sb.from('lancamentos').insert({user_id:S.user.id,...lanc}).select().single();
    if(error){appendMFin('agent','❌ Erro ao salvar: '+error.message);return false;}
    await syncFinanceiro();return true;
  } catch(e){appendMFin('agent','❌ Erro: '+e.message);return false;}
}

async function sendFinMsg(){
  const input=document.getElementById('fin-msg');const text=input.value.trim();if(!text)return;
  input.value='';
  appendMFin('user',text);
  await sb.from('conversas_financeiro').insert({user_id:S.user.id,role:'user',content:text});
  S.conversas_fin.push({role:'user',content:text});
  const mov=detectarMovimentacao(text);let lancRegistrado=false;
  if(mov){
    lancRegistrado=await registrarLancamentoFin(mov);
    if(lancRegistrado){
      const sinal=mov.tipo==='entrada'?'+':'-';
      document.getElementById('chat-fin').insertAdjacentHTML('beforeend',`<div style="padding:4px 14px 8px"><span style="display:inline-flex;align-items:center;gap:6px;background:rgba(46,204,113,.15);color:#2ecc71;padding:5px 14px;border-radius:8px;font-size:12px;font-weight:600;border:1px solid rgba(46,204,113,.3)">✓ Registrado: ${sinal} R$ ${mov.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})} — ${mov.categoria}</span></div>`);
      scrollFin();
    }
  }
  const SYSTEM_FIN=`Você é o Assistente Financeiro da plataforma DigitalMind. Analise EXCLUSIVAMENTE dados financeiros. Os lançamentos já foram registrados automaticamente. Confirme e analise o impacto. Responda em português brasileiro. Máximo 5 linhas.`;
  const btn=document.getElementById('send-fin');btn.disabled=true;
  const lid='lf-'+Date.now();
  document.getElementById('chat-fin').insertAdjacentHTML('beforeend',`<div class="msg agent" id="${lid}"><div class="msg-av">✈</div><div class="msg-bub"><div class="typing"><span></span><span></span><span></span></div></div></div>`);
  scrollFin();
  try {
    const ent=S.lancamentos.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+parseFloat(l.valor||0),0);
    const sai=S.lancamentos.filter(l=>l.tipo==='saida').reduce((s,l)=>s+parseFloat(l.valor||0),0);
    const finCtx=`Empresa: ${S.empresa?.nome||''} | Receitas: R$${ent.toFixed(2)} | Despesas: R$${sai.toFixed(2)} | Saldo: R$${(ent-sai).toFixed(2)}${lancRegistrado?`\n[Registrado: ${mov.tipo} R$${mov.valor} - ${mov.categoria}]`:''}`;
    const msgs=S.conversas_fin.slice(-20).map(c=>({role:c.role==='assistant'?'assistant':'user',content:c.content}));
    const res=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},body:JSON.stringify({messages:msgs,clientContext:finCtx,systemPrompt:SYSTEM_FIN})});
    document.getElementById(lid)?.remove();
    const data=await res.json();const reply=data.reply||'Erro.';
    await sb.from('conversas_financeiro').insert({user_id:S.user.id,role:'assistant',content:reply});
    S.conversas_fin.push({role:'assistant',content:reply});
    appendMFin('agent',reply);
  } catch(e){document.getElementById(lid)?.remove();appendMFin('agent','❌ Erro: '+e.message);}
  finally{btn.disabled=false;}
}

function scrollFin(){const el=document.getElementById('chat-fin');if(el)el.scrollTop=el.scrollHeight;}
function appendMFin(role,text){
  const lbl=role==='agent'?'DM':'👤';
  const fmt2=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>');
  document.getElementById('chat-fin')?.insertAdjacentHTML('beforeend',`<div class="msg ${role==='agent'?'agent':'user'}"><div class="msg-av">${lbl}</div><div class="msg-bub">${fmt2}</div></div>`);
  scrollFin();
}
function sendFinQ(t){document.getElementById('fin-msg').value=t;sendFinMsg();}

// ══════════════════════════════════════════════
// AGENTES ADM E MKT
// ══════════════════════════════════════════════
const S_adm=[];const S_mkt=[];

async function callSpecialAgent(userMsg,chatId,btnId,systemPrompt,historyArr){
  const btn=document.getElementById(btnId);if(btn)btn.disabled=true;
  appendSpecialMsg('user',userMsg,chatId);historyArr.push({role:'user',content:userMsg});
  const lid='ls-'+Date.now();
  document.getElementById(chatId)?.insertAdjacentHTML('beforeend',`<div class="msg agent" id="${lid}"><div class="msg-av">✈</div><div class="msg-bub"><div class="typing"><span></span><span></span><span></span></div></div></div>`);
  document.getElementById(chatId).scrollTop=99999;
  try {
    const ctx=S.empresa?`Empresa: ${S.empresa.nome} | Setor: ${S.empresa.setor}`:'';
    const msgs=historyArr.slice(-20).map(c=>({role:c.role==='assistant'?'assistant':'user',content:c.content}));
    const res=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},body:JSON.stringify({messages:msgs,clientContext:ctx,systemPrompt})});
    document.getElementById(lid)?.remove();const data=await res.json();const reply=data.reply||'Erro.';
    historyArr.push({role:'assistant',content:reply});appendSpecialMsg('agent',reply,chatId);
  } catch(e){document.getElementById(lid)?.remove();appendSpecialMsg('agent','❌ Erro: '+e.message,chatId);}
  finally{if(btn)btn.disabled=false;}
}

function appendSpecialMsg(role,text,chatId){
  const lbl=role==='agent'?'DM':'👤';
  const fmt2=text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>');
  document.getElementById(chatId)?.insertAdjacentHTML('beforeend',`<div class="msg ${role==='agent'?'agent':'user'}"><div class="msg-av">${lbl}</div><div class="msg-bub">${fmt2}</div></div>`);
  const el=document.getElementById(chatId);if(el)el.scrollTop=el.scrollHeight;
}

async function sendAdmMsg(){const input=document.getElementById('adm-msg');const text=input.value.trim();if(!text)return;input.value='';await callSpecialAgent(text,'chat-adm','send-adm',SYSTEM_ADM,S_adm);}
function sendAdmQ(t){document.getElementById('adm-msg').value=t;sendAdmMsg();}

function initAdmChat(){
  // Renderiza grid imediatamente com dados padrão
  renderSixpsGrid();

  // Depois carrega do banco e atualiza
  const home = document.getElementById('sixps-home');
  const mod = document.getElementById('sixps-modulo');
  if(home) home.style.display='block';
  if(mod) mod.style.display='none';
  SP.moduloAtivo = null;

  loadSixps(); // atualiza com progresso real do banco

  const el=document.getElementById('chat-adm');
  if(!el||el.innerHTML!=='')return;
  appendSpecialMsg('agent',`Olá! Sou o Assistente Administrativo do DigitalMind.\n\nVou guiar **${S.empresa?.nome||'sua empresa'}** pela **Metodologia 6Ps** — do propósito à performance.\n\nClique em um card abaixo para começar!`,'chat-adm');
}

// ══════════════════════════════════════════════
// MARKETING 5.0 — META INTEGRATION
// ══════════════════════════════════════════════
const MKT = {
  config: { appId:'232412925579546', pageId:'110932374086329', igId:'17841448739428898', bizId:'454821778490126', token:'', adsToken:'', adAccount:'act_374471102656220' },
  calDate: new Date(2026,2,1),
  events: [
    {date:'2026-03-22',title:'Post Semanal FB',plat:'facebook',color:'#1877F2'},
    {date:'2026-03-23',title:'Reels Instagram',plat:'instagram',color:'#e1306c'},
    {date:'2026-03-26',title:'Stories + Feed IG',plat:'instagram',color:'#e1306c'},
    {date:'2026-03-28',title:'Post de Valor FB',plat:'facebook',color:'#1877F2'},
    {date:'2026-03-30',title:'Reel Educativo',plat:'instagram',color:'#e1306c'},
    {date:'2026-04-01',title:'Campanha Ads Abril',plat:'facebook',color:'#1877F2'},
    {date:'2026-04-07',title:'Conteúdo UGC',plat:'instagram',color:'#e1306c'},
  ],
  metaContext: null,
  chatHistory: []
};

// Carrega config salva do localStorage — nunca sobrescreve com token hardcoded
(()=>{
  try {
    const s = localStorage.getItem('dm_mkt');
    if(s) { const c = JSON.parse(s); Object.assign(MKT.config, c); }
  } catch(e) {}
})();

function mktTab(tab, btn) {
  ['estrategia','campanhas','agente','crm','whatsapp','calendario','config','insights','posts','ads'].forEach(t=>{
    const el=document.getElementById('mkt-panel-'+t);
    if(el) el.style.display = t===tab ? 'block' : 'none';
  });
  document.querySelectorAll('[id^=mktab-]').forEach(b=>{ b.classList.remove('btn-primary'); b.classList.add('btn-ghost'); });
  if(btn){ btn.classList.remove('btn-ghost'); btn.classList.add('btn-primary'); }
  // Reseta scroll APÓS DOM atualizar
  requestAnimationFrame(()=>{
    document.body.scrollTop=0;
    document.documentElement.scrollTop=0;
    window.scrollTo({top:0,behavior:'instant'});
    const _m=document.querySelector('.main');if(_m)_m.scrollTop=0;
    const _c=document.querySelector('.content');if(_c)_c.scrollTop=0;
  });
  if(tab==='estrategia') { mktCarregarEstrategia(); }
  if(tab==='campanhas') { mktInitCampanhas(); }
  if(tab==='crm') crmCarregar();
  if(tab==='calendario') { setTimeout(initCronograma, 100); }
  if(tab==='config') { mktPopulateConfig(); }
  if(tab==='whatsapp') { setTimeout(()=>{waCarregarConfig();if(!document.getElementById('wa-panel-visao').style.display||document.getElementById('wa-panel-visao').style.display==='none'){waTab('visao',document.getElementById('watab-visao'));}waCarregarVisao();},50); }
}

function showPersonaTab(n) {
  [1,2,3].forEach(i => {
    const tab = document.getElementById('persona-tab-'+i);
    const btn = document.getElementById('ptab-'+i);
    if(tab) tab.style.display = i===n ? 'block' : 'none';
    if(btn) { btn.className = i===n ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'; btn.style.cssText = 'font-size:10px;padding:3px 10px;border-radius:6px'; }
  });
}

async function gerarPersonasIA() {
  const btn = document.querySelector('[onclick="gerarPersonasIA()"]');
  if(btn) { btn.textContent = '⏳ Gerando...'; btn.disabled = true; }
  if(!MZ || Object.keys(MZ).length === 0) await matrizCarregar();
  const contexto = matrizParaContexto();
  try {
    const res = await fetch(EDGE, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},
      body: JSON.stringify({
        messages:[{role:'user', content:`Com base nos dados da empresa, gere 3 personas de cliente ideal DISTINTAS entre si. Cada persona deve ter: nome fictício + cargo/perfil + faturamento/porte da empresa + dor principal + o que a faz contratar + como se comunica. Separe claramente como PERSONA 1:, PERSONA 2:, PERSONA 3:. Seja específico e use dados reais do contexto.\n\nContexto:\n${contexto}`}],
        systemPrompt:'Você é especialista em marketing e personas. Gere personas concretas, distintas e acionáveis. Use português brasileiro. Retorne apenas as 3 personas formatadas, sem introdução.'
      })
    });
    const data = await res.json();
    if(data.reply) {
      const partes = data.reply.split(/PERSONA [23]:/i);
      const p1 = (partes[0]||'').replace(/PERSONA 1:/i,'').trim();
      const p2 = (partes[1]||'').trim();
      const p3 = (partes[2]||'').trim();
      const fmt = t => t.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
      const el1 = document.getElementById('persona-tab-1');
      const el2 = document.getElementById('persona-tab-2');
      const el3 = document.getElementById('persona-tab-3');
      if(el1) el1.innerHTML = fmt(p1)||'Não gerado';
      if(el2) el2.innerHTML = fmt(p2)||'Não gerado';
      if(el3) el3.innerHTML = fmt(p3)||'Não gerado';
      // Atualiza labels das tabs
      const b1=document.getElementById('ptab-1'); if(b1) b1.textContent='Persona 1';
      const b2=document.getElementById('ptab-2'); if(b2) b2.textContent='Persona 2';
      const b3=document.getElementById('ptab-3'); if(b3) b3.textContent='Persona 3';
    }
  } catch(e) { console.error(e); }
  if(btn) { btn.textContent = '✨ Gerar com DM'; btn.disabled = false; }
}

async function mktCarregarEstrategia() {
  // Garante que a matriz está carregada
  if(!MZ || Object.keys(MZ).length === 0) {
    await matrizCarregar();
  }

  const pos = document.getElementById('mkt-estrat-posicionamento');
  const per = document.getElementById('mkt-estrat-persona');

  // Monta posicionamento com fallbacks
  if(pos) {
    const campos = [
      MZ.p5_proposta_valor && `<strong>Proposta de valor:</strong> ${MZ.p5_proposta_valor}`,
      MZ.p5_diferencial    && `<strong>Diferencial:</strong> ${MZ.p5_diferencial}`,
      MZ.p5_dor_central    && `<strong>Dor central:</strong> ${MZ.p5_dor_central}`,
      MZ.p5_canais         && `<strong>Canais:</strong> ${MZ.p5_canais}`,
      MZ.p5_posicionamento && `<strong>Posicionamento:</strong> ${MZ.p5_posicionamento}`,
    ].filter(Boolean);

    if(campos.length > 0) {
      pos.innerHTML = campos.join('<br>');
    } else {
      // Fallback: busca resumo bruto do sixps_dados
      try {
        const { data } = await sb.from('sixps_dados').select('resumo').eq('user_id', S.user.id).eq('modulo', 'p5').limit(1);
        if(data && data[0] && data[0].resumo) {
          const resumo = data[0].resumo.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
          pos.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Dados do P5 (resumo bruto):</div>${resumo}`;
          // Tenta extrair e salvar na matriz para futuras consultas
          if(data[0].resumo.length > 100) {
            extrairEAtualizarMatriz('p5', data[0].resumo).catch(()=>{});
          }
        } else {
          pos.innerHTML = '<span style="color:var(--muted);font-style:italic">Complete o P5 no Administrativo para ver o posicionamento aqui.</span>';
        }
      } catch(e) {
        pos.innerHTML = '<span style="color:var(--muted);font-style:italic">Complete o P5 para ver o posicionamento aqui.</span>';
      }
    }
  }

  // Monta persona com fallbacks
  const perTab1 = document.getElementById('persona-tab-1');
  if(perTab1) {
    const campos = [
      MZ.p5_persona_nome   && `<strong>Persona principal:</strong> ${MZ.p5_persona_nome}`,
      MZ.p5_persona_perfil && `<strong>Perfil:</strong> ${MZ.p5_persona_perfil}`,
      MZ.p5_dor_central    && `<strong>Principal dor:</strong> ${MZ.p5_dor_central}`,
    ].filter(Boolean);

    if(campos.length > 0) {
      perTab1.innerHTML = campos.join('<br>');
      // Gera as outras 2 personas automaticamente se ainda não foram geradas
      const el2 = document.getElementById('persona-tab-2');
      const el3 = document.getElementById('persona-tab-3');
      if(el2 && el2.innerHTML === 'Carregando...') {
        setTimeout(gerarPersonasIA, 1000);
      }
    } else {
      try {
        const { data } = await sb.from('sixps_dados').select('resumo').eq('user_id', S.user.id).eq('modulo', 'p5').limit(1);
        if(data && data[0] && data[0].resumo) {
          const resumo = data[0].resumo;
          const personaMatch = resumo.match(/persona[:\s]+([^\n]+)/i);
          const perfilMatch  = resumo.match(/perfil[:\s]+([^\n]+)/i);
          if(personaMatch || perfilMatch) {
            perTab1.innerHTML = [
              personaMatch && `<strong>Persona:</strong> ${personaMatch[1]}`,
              perfilMatch  && `<strong>Perfil:</strong> ${perfilMatch[1]}`,
            ].filter(Boolean).join('<br>');
          } else {
            perTab1.innerHTML = '<span style="color:var(--muted);font-style:italic">Clique em "✨ Gerar com DM" para criar 3 personas baseadas no seu P5.</span>';
          }
          setTimeout(gerarPersonasIA, 500);
        } else {
          perTab1.innerHTML = '<span style="color:var(--muted);font-style:italic">Complete o P5 no Administrativo para ver a persona aqui.</span>';
        }
      } catch(e) {
        perTab1.innerHTML = '<span style="color:var(--muted);font-style:italic">Complete o P5 para ver a persona aqui.</span>';
      }
    }
  }

  setTimeout(initMktChat, 200);
}

function mktInitCampanhas() {
  dashCarregarMktCampanhas();
}

function mktPopulateConfig(){
  document.getElementById('mkt-cfg-appid').value = MKT.config.appId||'';
  document.getElementById('mkt-cfg-pageid').value = MKT.config.pageId||'';
  document.getElementById('mkt-cfg-igid').value = MKT.config.igId||'';
  document.getElementById('mkt-cfg-bizid').value = MKT.config.bizId||'';
  document.getElementById('mkt-cfg-adaccount').value = MKT.config.adAccount||'';
  document.getElementById('mkt-cfg-token').value = MKT.config.token||'';
  const adsEl = document.getElementById('mkt-cfg-ads-token');
  if(adsEl) adsEl.value = MKT.config.adsToken||'';
}

function mktSaveConfig(){
  MKT.config.appId = document.getElementById('mkt-cfg-appid').value.trim();
  MKT.config.pageId = document.getElementById('mkt-cfg-pageid').value.trim();
  MKT.config.igId = document.getElementById('mkt-cfg-igid').value.trim();
  MKT.config.bizId = document.getElementById('mkt-cfg-bizid').value.trim();
  MKT.config.adAccount = document.getElementById('mkt-cfg-adaccount').value.trim();
  const newToken = document.getElementById('mkt-cfg-token').value.trim();
  if(newToken) MKT.config.token = newToken;
  const adsEl = document.getElementById('mkt-cfg-ads-token');
  if(adsEl && adsEl.value.trim()) MKT.config.adsToken = adsEl.value.trim();
  // Remove _pageToken cache para forçar nova busca
  delete MKT.config._pageToken;
  localStorage.setItem('dm_mkt', JSON.stringify(MKT.config));
  alert('✅ Config salvo! Carregando insights...');
  mktLoadInsights();
  DS.carregar();
}

const META_BASE = 'https://graph.facebook.com/v25.0';

// ══════════════════════════════════════════════
// CHART HELPERS — buildDonut, buildBar etc.
// ══════════════════════════════════════════════
function buildDonut(canvasId, legendId, labels, data, colors) {
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  const COLORS = colors || ['#7c6dfa','#4ecdc4','#f7b731','#ff6b6b','#1877F2','#e1306c','#25d366','#a78bfa','#34d399','#fb923c'];
  const key = '_ch_'+canvasId;
  if(window[key]) { try{window[key].destroy();}catch(e){} }
  const total = data.reduce((s,v)=>s+v,0);
  if(!total) return;
  window[key] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets:[{ data, backgroundColor: COLORS.slice(0,data.length), borderColor:'#0f0f1a', borderWidth:2 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'68%',
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:'#1a1a26',titleColor:'#f0f0f5',bodyColor:'#8080a0',borderColor:'rgba(255,255,255,.1)',borderWidth:1,
          callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw.toLocaleString('pt-BR')} (${total>0?(ctx.raw/total*100).toFixed(1):'0'}%)`}}
      }
    }
  });
  // Legenda manual
  const leg = document.getElementById(legendId);
  if(leg) leg.innerHTML = labels.map((l,i)=>`
    <div style="display:flex;align-items:center;gap:4px;font-size:10px">
      <span style="width:8px;height:8px;border-radius:2px;background:${COLORS[i%COLORS.length]};flex-shrink:0"></span>
      <span style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px">${l}</span>
      <span style="margin-left:auto;font-weight:700;font-family:monospace;color:var(--text)">${total>0?(data[i]/total*100).toFixed(0)+'%':'0%'}</span>
    </div>`).join('');
}

// Google Calendar
const GCAL_CLIENT_ID = '871992392711-4eddnrj4r73behec9op8injr87bcg7hv.apps.googleusercontent.com';
const GCAL_API_KEY   = 'AIzaSyAiABhgsq1dd83p7jZrYRfp7nnQF0R2AwY';
const GCAL_SCOPE     = 'https://www.googleapis.com/auth/calendar.events';
const GCAL_DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
let gcalInited = false;
let gcalAuthorized = false;

async function metaGet(path, params={}, tokenOverride=null) {
  const token = tokenOverride || MKT.config.token;
  if(!token) throw new Error('Page Access Token não configurado');
  const url = new URL(META_BASE + path);
  url.searchParams.set('access_token', token);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const res = await fetch(url.toString());
  const data = await res.json();
  if(data.error) throw new Error(data.error.message||JSON.stringify(data.error));
  return data;
}

function mktFmt(n){ if(n>=1e6)return(n/1e6).toFixed(1)+'M'; if(n>=1e3)return(n/1e3).toFixed(1)+'K'; return String(n||0); }
function mktSum(vals=[]){ return (vals||[]).reduce((s,v)=>s+(v.value||0),0); }

function mktSetStatus(ok, text=''){
  const badge = document.getElementById('mkt-api-status');
  if(!badge)return;
  badge.innerHTML = `<span style="width:6px;height:6px;background:${ok?'var(--success)':'var(--danger)'};border-radius:50%;display:inline-block"></span> ${text||'API v25'}`;
}

async function mktLoadInsights(){
  const errEl=document.getElementById('mkt-api-error');
  const warnEl=document.getElementById('mkt-token-warn');
  if(errEl) errEl.style.display='none';
  if(!MKT.config.token){if(warnEl)warnEl.style.display='flex';mktSetStatus(false,'Sem token');return;}
  if(warnEl) warnEl.style.display='none';
  const period=document.getElementById('mkt-period')?.value||'week';
  await Promise.all([mktLoadFacebook(period), mktLoadInstagram(), mktLoadWhatsApp()]);
  // Gráficos extras carregados por dashCarregarTudo
  setTimeout(()=>{ dashLoadIgBreakdown(); }, 400);
  // NÃO sobrescreve KPIs aqui — dashLoadCampanhasUnificado cuida disso
}

async function mktLoadFacebook(period){
  try {
    let pageToken = MKT.config.token;

    // System User Token → busca Page Token automaticamente
    // O endpoint /{page-id}?fields=access_token com System User Token retorna o Page Token
    if(!MKT.config._pageToken) {
      try {
        const ptRes = await fetch(`${META_BASE}/${MKT.config.pageId}?fields=access_token&access_token=${MKT.config.token}`);
        const ptData = await ptRes.json();
        if(ptData.access_token) {
          MKT.config._pageToken = ptData.access_token;
          pageToken = ptData.access_token;
        }
      } catch(e2) { /* usa token original */ }
    } else {
      pageToken = MKT.config._pageToken;
    }

    const page=await metaGet('/'+MKT.config.pageId,{fields:'name,fan_count,followers_count,about,category,link'}, pageToken);
    const badge=document.getElementById('mkt-page-badge');if(badge)badge.textContent='🔗 '+(page.name||'Página');
    const fbStatus=document.getElementById('mk-fb-status');if(fbStatus)fbStatus.textContent='✅ conectado';
    const fans=document.getElementById('mk-fans');if(fans)fans.textContent=mktFmt(page.fan_count||page.followers_count||0);
    document.getElementById('mkt-pageinfo').innerHTML=`<div style="display:flex;flex-direction:column;gap:7px">
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Página</span><span style="font-size:12px;font-weight:600">${page.name||'—'}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Categoria</span><span style="font-size:12px">${page.category||'—'}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Seguidores</span><span style="font-size:12px;font-weight:700;color:#1877F2">${mktFmt(page.followers_count||0)}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Curtidas</span><span style="font-size:12px;font-weight:600">${mktFmt(page.fan_count||0)}</span></div>
      ${page.about?`<div style="font-size:11px;color:var(--muted);margin-top:4px;padding:8px;background:var(--surface2);border-radius:6px;line-height:1.5">${page.about.slice(0,120)}</div>`:''}
      ${page.link?`<a href="${page.link}" target="_blank" style="font-size:11px;color:var(--accent)">${page.link} ↗</a>`:''}
    </div>`;
    try {
      const ins=await metaGet('/'+MKT.config.pageId+'/insights',{metric:'page_post_engagements,page_views_total,page_total_actions,page_video_views',period}, pageToken);
      const dm={};(ins.data||[]).forEach(m=>{dm[m.name]=m.values;});
      const views=mktSum(dm['page_views_total']),eng=mktSum(dm['page_post_engagements']),cta=mktSum(dm['page_total_actions']),vids=mktSum(dm['page_video_views']);
      const vEl=document.getElementById('mk-views');if(vEl)vEl.textContent=mktFmt(views);
      const eEl=document.getElementById('mk-eng');if(eEl)eEl.textContent=mktFmt(eng);
      const cEl=document.getElementById('mk-cta');if(cEl)cEl.textContent=mktFmt(cta);
      const vidEl=document.getElementById('mk-video');if(vidEl)vidEl.textContent=mktFmt(vids);
      const bd=document.getElementById('mkt-breakdown');
      if(bd){const total=Math.max(views,1);bd.innerHTML=[{label:'📹 Views vídeo',val:vids,color:'var(--accent)'},{label:'❤️ Engajamentos',val:eng,color:'var(--success)'},{label:'👆 Ações CTA',val:cta,color:'var(--fin)'}].map(i=>`<div><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:11px">${i.label}</span><span style="font-size:11px;font-weight:700;font-family:monospace;color:${i.color}">${mktFmt(i.val)}</span></div><div style="height:3px;background:var(--surface2);border-radius:3px"><div style="height:100%;width:${Math.min(100,Math.round((i.val/total)*100))}%;background:${i.color};border-radius:3px"></div></div></div>`).join('');}
      MKT.metaContext={page,metrics:{views,eng,cta,vids}};
    } catch(insErr) {
      // Insights podem falhar mesmo com page token — exibe dados básicos da página
      const errEl=document.getElementById('mkt-api-error');
      if(errEl){errEl.textContent='⚠️ Insights FB: '+insErr.message;errEl.style.display='block';}
    }
    mktSetStatus(true,'API v25 OK');
  }catch(e){
    mktSetStatus(false,'Erro FB');
    const errEl=document.getElementById('mkt-api-error');
    if(errEl){errEl.textContent='❌ Facebook: '+e.message;errEl.style.display='block';}
  }
}

async function mktLoadInstagram(){
  const igStatus=document.getElementById('mk-ig-status');
  const igDetails=document.getElementById('mkt-ig-details');
  if(!MKT.config.igId){if(igStatus)igStatus.textContent='sem ID';if(igDetails)igDetails.textContent='Configure o Instagram Account ID em Config META.';return;}
  // Usa page token se disponível (necessário para /insights)
  const pageToken = MKT.config._pageToken || MKT.config.token;
  try {
    const pageIg=await metaGet('/'+MKT.config.pageId,{fields:'instagram_business_account'}, pageToken);
    const igId=pageIg.instagram_business_account?.id||MKT.config.igId;
    const ig=await metaGet('/'+igId,{fields:'name,username,followers_count,media_count,biography,website'}, pageToken);
    document.getElementById('mk-ig-fans').textContent=mktFmt(ig.followers_count||0);
    document.getElementById('mk-ig-posts').textContent=mktFmt(ig.media_count||0);
    if(igStatus)igStatus.textContent='✅ @'+ig.username;
    try{
      const igIns=await metaGet('/'+igId+'/insights',{
        metric:'reach,impressions',
        period:'day',
        since: new Date(Date.now()-7*86400000).toISOString().slice(0,10),
        until: new Date().toISOString().slice(0,10)
      }, pageToken);
      const igDm={};(igIns.data||[]).forEach(m=>{igDm[m.name]=m.values;});
      document.getElementById('mk-ig-reach').textContent=mktFmt(mktSum(igDm['reach']));
      document.getElementById('mk-ig-imp').textContent=mktFmt(mktSum(igDm['impressions']));
    }catch(e2){
      // IG insights requer aprovação extra da Meta — mostra dash silenciosamente
      document.getElementById('mk-ig-reach').textContent='—';
      document.getElementById('mk-ig-imp').textContent='—';
    }
    if(igDetails)igDetails.innerHTML=`<div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Usuário</span><span style="font-size:12px;font-weight:700">@${ig.username||'—'}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Seguidores</span><span style="font-size:12px;font-weight:700;color:#e1306c">${mktFmt(ig.followers_count||0)}</span></div>
      <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Posts</span><span style="font-size:12px;font-weight:600">${mktFmt(ig.media_count||0)}</span></div>
      ${ig.biography?`<div style="font-size:11px;color:var(--muted);margin-top:4px;padding:8px;background:var(--surface2);border-radius:6px;line-height:1.5">${ig.biography.slice(0,100)}</div>`:''}
      ${ig.website?`<a href="${ig.website}" target="_blank" style="font-size:11px;color:var(--accent)">${ig.website} ↗</a>`:''}
    </div>`;
    try{
      const mediaRes=await metaGet('/'+igId+'/media',{fields:'like_count,comments_count',limit:20}, pageToken);
      const totalLikes=(mediaRes.data||[]).reduce((s,p)=>s+(p.like_count||0),0);
      const igEngEl=document.getElementById('mk-ig-eng');if(igEngEl)igEngEl.textContent=mktFmt(totalLikes);
    }catch(e2){}
    if(MKT.metaContext)MKT.metaContext.instagram={username:ig.username,followers:ig.followers_count,posts:ig.media_count};
  }catch(e){
    if(igStatus)igStatus.textContent='⚠ erro: '+e.message.slice(0,30);
    if(igDetails)igDetails.textContent='Erro: '+e.message;
    document.getElementById('mk-ig-fans').textContent='—';
  }
}

async function mktLoadWhatsApp(){
  const wppInfo=document.getElementById('mk-wpp-info');
  if(!MKT.config.adAccount) MKT.config.adAccount = 'act_374471102656220';
  const adAccount = MKT.config.adAccount;
  try {
    const res=await metaGet('/'+adAccount+'/campaigns',{fields:'id,name,status,objective',limit:50});
    const camps=res.data||[];
    const wppCamps=camps.filter(c=>c.name&&(c.name.toLowerCase().includes('whatsapp')||c.name.toLowerCase().includes('wpp')||c.name.toLowerCase().includes('zap')||c.objective==='MESSAGES'));
    let totalSpend=0,totalConv=0;
    const list=wppCamps.length>0?wppCamps:camps;
    await Promise.all(list.slice(0,10).map(async c=>{
      try{
        const ins=await metaGet('/'+c.id+'/insights',{fields:'spend,actions',date_preset:'last_30d'});
        const d=ins.data?.[0]||{};
        totalSpend+=parseFloat(d.spend||0);
        const conv=(d.actions||[]).find(a=>a.action_type&&(a.action_type.includes('messaging')||a.action_type.includes('whatsapp')));
        if(conv)totalConv+=parseInt(conv.value||0);
      }catch(e){}
    }));
    document.getElementById('mk-wpp-conv').textContent=mktFmt(totalConv)||'—';
    document.getElementById('mk-wpp-spend').textContent=totalSpend>0?'R$ '+totalSpend.toFixed(2):'R$ —';
    document.getElementById('mk-wpp-cpc').textContent=(totalConv>0&&totalSpend>0)?'R$ '+(totalSpend/totalConv).toFixed(2):'—';
    document.getElementById('mk-wpp-camps').textContent=camps.length;
    if(wppInfo)wppInfo.textContent=wppCamps.length>0?wppCamps.length+' campanha(s) Click-to-WhatsApp · dados reais':'Métricas de todas as campanhas · clique no card para detalhes';
  }catch(e){
    document.getElementById('mk-wpp-conv').textContent='—';
    const wppInfoEl=document.getElementById('mk-wpp-info');
    if(wppInfoEl)wppInfoEl.textContent='⚠ '+e.message;
  }
}

async function mktTestMeta(){
  const token = document.getElementById('mkt-cfg-token').value.trim() || MKT.config.token;
  const adsToken = document.getElementById('mkt-cfg-ads-token')?.value.trim() || MKT.config.adsToken || token;
  const pageId = document.getElementById('mkt-cfg-pageid').value.trim() || MKT.config.pageId;
  if(!token){alert('Nenhum token configurado. Cole um token no campo acima.');return;}

  const lines = [];
  try {
    // Testa User Token em /me (funciona com adsToken)
    try {
      const meRes = await fetch(`${META_BASE}/me?fields=id,name&access_token=${adsToken}`);
      const me = await meRes.json();
      if(me.error) lines.push('⚠️ User Token: '+me.error.message);
      else lines.push(`✅ User Token válido — ${me.name} (${me.id})`);

      // Debug token info
      const dbRes = await fetch(`${META_BASE}/debug_token?input_token=${adsToken}&access_token=${adsToken}`);
      const db = await dbRes.json();
      const d = db.data||{};
      const exp = d.expires_at ? new Date(d.expires_at*1000).toLocaleDateString('pt-BR') : (d.is_valid&&!d.expires_at?'Não expira':'?');
      lines.push(`Tipo: ${d.type||'?'} | Expira: ${exp} | Permissões: ${(d.scopes||[]).length}`);
    } catch(e2) { lines.push('(sem user token para testar)'); }

    // Testa Page Token na página
    try {
      const pgRes = await fetch(`${META_BASE}/${pageId}?fields=name,followers_count&access_token=${token}`);
      const pg = await pgRes.json();
      if(pg.error) lines.push(`⚠️ Page Token: ${pg.error.message}`);
      else lines.push(`✅ Página: ${pg.name} · ${pg.followers_count} seguidores`);
    } catch(e3) { lines.push('❌ Page Token inválido'); }

    // Testa Ads Account
    try {
      const adRes = await fetch(`${META_BASE}/${MKT.config.adAccount}/campaigns?limit=1&access_token=${adsToken}`);
      const ad = await adRes.json();
      if(ad.error) lines.push(`⚠️ Ads: ${ad.error.message}`);
      else lines.push(`✅ Ads Account: ${MKT.config.adAccount} — OK`);
    } catch(e4) { lines.push('❌ Ads Account com erro'); }

  } catch(e){ lines.push('❌ '+e.message); }
  alert(lines.join('\n'));
}

async function mktGerarTokenPermanente(){
  const tempToken = document.getElementById('mkt-temp-token').value.trim();
  const statusEl  = document.getElementById('mkt-token-status');
  const appId     = MKT.config.appId     || '232412925579546';
  const appSecret = '89c200f6958a0307cb9fb3691cdcb81a';
  const pageId    = MKT.config.pageId    || '110932374086329';

  if(!tempToken){
    alert('Cole o token temporário do Graph API Explorer no campo acima.');
    return;
  }

  const show = (msg, type='info') => {
    statusEl.style.display = 'block';
    const colors = { info:'rgba(124,109,250,.15)', success:'rgba(46,204,113,.15)', error:'rgba(255,107,107,.15)' };
    const textColors = { info:'var(--accent)', success:'var(--success)', error:'var(--danger)' };
    statusEl.style.background = colors[type];
    statusEl.style.color = textColors[type];
    statusEl.style.border = '1px solid '+textColors[type].replace('var(--','').replace(')','');
    statusEl.innerHTML = msg;
  };

  try {
    // PASSO 1 — Troca token curto por token longo (60 dias)
    show('⏳ Passo 1/3 — Trocando por token de longa duração (60 dias)...');
    const longRes = await fetch(
      `${META_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(tempToken)}`
    );
    const longData = await longRes.json();
    if(longData.error) throw new Error('Passo 1 falhou: '+longData.error.message);
    const longToken = longData.access_token;
    show('✅ Passo 1/3 — Token longo gerado.<br>⏳ Passo 2/3 — Buscando token permanente da página...');

    // PASSO 2 — Pega token permanente da página com o token longo
    const pageRes = await fetch(
      `${META_BASE}/${pageId}?fields=access_token,name&access_token=${longToken}`
    );
    const pageData = await pageRes.json();
    if(pageData.error) throw new Error('Passo 2 falhou: '+pageData.error.message);
    const permanentToken = pageData.access_token;
    if(!permanentToken) throw new Error('Token de página não retornado. Verifique se o usuário é admin da página.');

    // PASSO 3 — Valida o token permanente
    show('✅ Passo 2/3 — Token permanente obtido.<br>⏳ Passo 3/3 — Validando...');
    const validateRes = await fetch(
      `${META_BASE}/${pageId}?fields=name,fan_count,followers_count&access_token=${permanentToken}`
    );
    const validateData = await validateRes.json();
    if(validateData.error) throw new Error('Validação falhou: '+validateData.error.message);

    // Sucesso — salva como token de página E token de ads (funciona para ambos)
    MKT.config.token    = permanentToken;
    MKT.config.adsToken = longToken; // token longo do usuário para ads
    localStorage.setItem('dm_mkt', JSON.stringify(MKT.config));
    document.getElementById('mkt-cfg-token').value = permanentToken;
    const adsEl = document.getElementById('mkt-cfg-ads-token');
    if(adsEl) adsEl.value = longToken;
    document.getElementById('mkt-temp-token').value = '';

    show(`✅ <strong>Tokens salvos com sucesso!</strong><br>
      Página: ${validateData.name} · ${validateData.followers_count} seguidores<br>
      ✅ Token de página (insights) — permanente, não expira<br>
      ✅ Token de usuário (ads) — 60 dias, renovável<br>
      <span style="opacity:.7;font-size:11px">Salvos automaticamente. Você pode usar Campanhas agora.</span>`, 'success');

    // Recarrega insights automaticamente
    setTimeout(()=>mktLoadInsights(), 1500);

  } catch(e) {
    show(`❌ <strong>Erro:</strong> ${e.message}<br>
      <span style="font-size:11px;opacity:.8">Certifique-se de usar um token de USUÁRIO (não de página) do Graph API Explorer, gerado com as permissões pages_read_engagement e read_insights.</span>`, 'error');
  }
}

async function mktLoadPosts(){
  const listEl = document.getElementById('mkt-posts-list');
  listEl.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px">Buscando posts...</div>';
  try {
    const postsRes = await metaGet('/'+MKT.config.pageId+'/posts',{fields:'id,message,created_time,type,permalink_url',limit:20});
    const posts = postsRes.data||[];
    if(!posts.length){listEl.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px">Nenhum post encontrado.</div>';return;}

    const icons={video:'🎬',photo:'🖼️',link:'🔗',status:'💬',reel:'📹'};
    const withIns = await Promise.all(posts.map(async p=>{
      try{
        const ins=await metaGet('/'+p.id+'/insights',{metric:'post_impressions_unique,post_engagements,post_clicks',period:'lifetime'});
        const dm={};(ins.data||[]).forEach(m=>dm[m.name]=m.values?.[0]?.value||0);
        return{...p,reach:dm['post_impressions_unique']||0,eng:dm['post_engagements']||0,clicks:dm['post_clicks']||0};
      }catch(e){return{...p,reach:0,eng:0,clicks:0};}
    }));

    listEl.innerHTML = withIns.map(p=>`
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;display:grid;grid-template-columns:32px 1fr auto auto auto;align-items:center;gap:12px;cursor:pointer;transition:border-color .15s" onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='var(--border)'" onclick="window.open('${p.permalink_url||'#'}','_blank')">
        <div style="font-size:20px">${icons[p.type]||'📝'}</div>
        <div>
          <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px">${(p.message||'(sem texto)').slice(0,80)}${(p.message||'').length>80?'…':''}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${new Date(p.created_time).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}</div>
        </div>
        <div style="text-align:right"><div style="font-size:14px;font-weight:700;font-family:monospace">${mktFmt(p.reach)}</div><div style="font-size:10px;color:var(--muted)">alcance</div></div>
        <div style="text-align:right"><div style="font-size:14px;font-weight:700;font-family:monospace">${mktFmt(p.eng)}</div><div style="font-size:10px;color:var(--muted)">engaj.</div></div>
        <span style="padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(78,205,196,.15);color:var(--mkt)">${p.type||'post'}</span>
      </div>`).join('');
  } catch(e){
    listEl.innerHTML=`<div style="color:var(--danger);font-size:13px;text-align:center;padding:24px">❌ ${e.message}</div>`;
  }
}

// Período atual de ads
let ADS_PERIOD = 'last_30d';
let ADS_DATE_FROM = null;
let ADS_DATE_TO = null;
// ═══════════════════════════════════════════════════════════
// DASHBOARD ENGINE — Estado centralizado
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════
// DS — Dashboard State (única fonte de verdade)
// ═══════════════════════════════════════════
const DS = {
  // Estado
  preset: 'maximum',   // "Tudo" = maximum na API Meta
  dateFrom: null,
  dateTo: null,
  filtro: '',          // id da campanha ou '' para todas
  campanhas: [],       // [{id,name,status,spend,reach,impressions,clicks,cpm,cpc,ctr,leads}]
  anuncios: [],        // [{id,name,campaign_id,creative,spend,impressions,clicks,ctr,cpm,cpc,leads}]
  roi: {},             // {[campId]: {vendas, ticket}}
  metricLinha: 'spend',
  metricBarras: 'cpm',

  // ── Período ──────────────────────────────
  getPeriodParams() {
    if(this.dateFrom && this.dateTo)
      return {time_range: JSON.stringify({since:this.dateFrom, until:this.dateTo})};
    // Mapa de presets válidos para a API de Ads Meta
    const p = this.preset || 'maximum';
    // 'lifetime' não é válido — usa maximum
    return {date_preset: p === 'lifetime' ? 'maximum' : p};
  },

  setPeriod(p, btn) {
    this.preset = p;
    this.dateFrom = null;
    this.dateTo = null;
    document.querySelectorAll('[id^=dashbtn-]').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    const df=document.getElementById('dash-date-from'); if(df)df.value='';
    const dt=document.getElementById('dash-date-to');   if(dt)dt.value='';
    this.carregar();
  },

  setPeriodCustom() {
    const from=document.getElementById('dash-date-from')?.value;
    const to=document.getElementById('dash-date-to')?.value;
    if(!from||!to){alert('Selecione data início e fim.');return;}
    this.preset = null;
    this.dateFrom = from;
    this.dateTo = to;
    document.querySelectorAll('[id^=dashbtn-]').forEach(b=>b.classList.remove('active'));
    this.carregar();
  },

  // ── Filtro campanha (local, sem API) ──────
  setFiltro(campId) {
    this.filtro = campId;
    this.renderTudo();
  },

  setMetricLinha(m, btn) {
    this.metricLinha = m;
    document.querySelectorAll('[onclick^="DS.setMetricLinha"]').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    this.renderLinha();
  },

  setMetricBarras(m, btn) {
    this.metricBarras = m;
    document.querySelectorAll('[onclick^="DS.setMetricBarras"]').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    this.renderBarras();
  },

  // ── Carregamento principal ────────────────
  async carregar() {
    if(!MKT.config.token) {
      const w=document.getElementById('mkt-token-warn'); if(w)w.style.display='flex'; return;
    }
    if(!MKT.config.adAccount) MKT.config.adAccount='act_374471102656220';

    // Mostra progresso na barra de update
    const upd=document.getElementById('dash-last-update');
    if(upd) upd.textContent='⏳ Carregando campanhas...';
    this._setLoading(true);
    try {

      if(upd) upd.textContent='⏳ Carregando insights...';
      await this._carregarCampanhas();

      if(upd) upd.textContent='⏳ Carregando plataformas...';
      await this._carregarPlatOrg();

      this.renderTudo();

      if(upd) upd.textContent='⏳ Carregando criativos...';
      // Criativos e demographics em background — sem bloquear UI
      this._carregarAnuncios();
      setTimeout(()=>this._carregarDemographics(), 300);
      setTimeout(()=>this._carregarIgTipos(), 400);
    } catch(e) {
      console.error('DS.carregar:', e);
      const errEl=document.getElementById('mkt-api-error');
      if(errEl){errEl.textContent='❌ Erro: '+e.message;errEl.style.display='block';}
    } finally {
      this._setLoading(false);
    }
  },

  _setLoading(on) {
    const ids=['dk-invest','dk-alcance','dk-impr','dk-leads','dk-cpm','dk-cpc','dk-roas'];
    ids.forEach(id=>{
      const el=document.getElementById(id);
      if(el){
        if(on){ el.textContent='⏳'; el.style.opacity='.35'; }
        else  { el.style.opacity='1'; }
      }
    });
    const el=document.getElementById('dash-last-update');
    if(on&&el)el.textContent='Carregando...';
  },

  async _carregarCampanhas() {
    const adsToken=MKT.config.adsToken||MKT.config.token;
    if(!adsToken)return;
    const pp=this.getPeriodParams();
    try {
      // ── PASSO 1: Lista campanhas (1 chamada) ──
      const res=await metaGet('/'+MKT.config.adAccount+'/campaigns',{
        fields:'id,name,status,objective',
        limit:50
      },adsToken);
      const camps=(res.data||[]).filter(c=>c.status!=='DELETED');
      if(!camps.length){ this.campanhas=[]; return; }

      // Popula selector
      const sel=document.getElementById('dash-camp-sel');
      if(sel){
        const cur=sel.value;
        sel.innerHTML='<option value="">Todas as campanhas</option>'+
          camps.map(c=>`<option value="${c.id}">${c.name.replace(/\[.*?\]\s*/g,'').slice(0,40)}</option>`).join('');
        if(cur)sel.value=cur;
      }

      // ── PASSO 2: Insights agregados no nível da conta (1 chamada) ──
      // Retorna breakdown por campanha — muito mais rápido
      let acctIns = {};
      try {
        const acctRes = await metaGet('/'+MKT.config.adAccount+'/insights',{
          fields:'campaign_id,campaign_name,spend,reach,impressions,clicks,cpm,cpc,ctr,actions',
          level:'campaign',
          limit:50,
          ...pp
        }, adsToken);
        (acctRes.data||[]).forEach(d=>{ acctIns[d.campaign_id]=d; });
      } catch(e2) {
        console.warn('insights conta falhou, tentando por campanha:', e2.message);
      }

      // ── PASSO 3: Para campanhas sem dados no período, busca maximum em paralelo (1 chamada por campanha) ──
      const semDados = camps.filter(c=>!acctIns[c.id]);
      if(semDados.length && Object.keys(acctIns).length === 0) {
        // Se a chamada da conta falhou totalmente, tenta por campanha em lotes
        for(let i=0;i<camps.slice(0,20).length;i+=5){
          const batch=camps.slice(i,i+5);
          await Promise.all(batch.map(async c=>{
            try{
              const ins=await metaGet('/'+c.id+'/insights',{
                fields:'spend,reach,impressions,clicks,cpm,cpc,ctr,actions',
                date_preset:'maximum'
              },adsToken);
              if(ins.data?.[0]) acctIns[c.id]=ins.data[0];
            }catch(e3){}
          }));
        }
      }

      // ── PASSO 4: Monta resultado ──
      const result = camps.map(c=>{
        const d = acctIns[c.id] || {};
        const conv=(d.actions||[]).find(a=>a.action_type&&(
          a.action_type.includes('messaging')||a.action_type.includes('lead')||a.action_type.includes('contact')
        ));
        return {...c,
          spend:parseFloat(d.spend||0), reach:parseInt(d.reach||0),
          impressions:parseInt(d.impressions||0), clicks:parseInt(d.clicks||0),
          cpm:parseFloat(d.cpm||0), cpc:parseFloat(d.cpc||0), ctr:parseFloat(d.ctr||0),
          leads:parseInt(conv?.value||0),
          _period: Object.keys(pp)[0] // marca qual período foi usado
        };
      });

      this.campanhas=result;
      const comDados=result.filter(c=>c.spend>0||c.impressions>0).length;
      console.log(`✅ ${result.length} camp. · ${comDados} com dados · período: ${JSON.stringify(pp)}`);
    } catch(e){console.error('_carregarCampanhas:',e.message);}
  },

  async _insightsCampanha(c, pp, adsToken) {
    // Mantido para compatibilidade mas não usado no fluxo principal
    try {
      const ins=await metaGet('/'+c.id+'/insights',{fields:'spend,reach,impressions,clicks,cpm,cpc,ctr,actions',...pp},adsToken);
      const d=ins.data?.[0]||{};
      const conv=(d.actions||[]).find(a=>a.action_type&&(a.action_type.includes('messaging')||a.action_type.includes('lead')));
      return {...c,spend:parseFloat(d.spend||0),reach:parseInt(d.reach||0),impressions:parseInt(d.impressions||0),clicks:parseInt(d.clicks||0),cpm:parseFloat(d.cpm||0),cpc:parseFloat(d.cpc||0),ctr:parseFloat(d.ctr||0),leads:parseInt(conv?.value||0)};
    }catch(e){return {...c,spend:0,reach:0,impressions:0,clicks:0,cpm:0,cpc:0,ctr:0,leads:0};}
  },

  async _carregarPlatOrg() {
    // Page insights aceita: day, week, days_28, month, lifetime
    // Ads presets (last_7d, last_30d etc.) precisam ser mapeados
    const presetMap = {
      'last_7d':'day', 'last_14d':'week', 'last_30d':'days_28',
      'last_90d':'days_28', 'last_year':'days_28', 'maximum':'days_28'
    };
    const p = this.dateFrom ? 'day' : (presetMap[this.preset] || 'days_28');
    await Promise.all([mktLoadFacebook(p), mktLoadInstagram(), mktLoadWhatsApp()]);
  },

  async _carregarAnuncios() {
    const adsToken=MKT.config.adsToken||MKT.config.token;
    if(!adsToken||!MKT.config.adAccount)return;
    const pp=this.getPeriodParams();
    try {
      // Busca ads com creative em uma chamada
      const res=await metaGet('/'+MKT.config.adAccount+'/ads',{
        fields:'id,name,status,campaign_id,creative{id,name,thumbnail_url,object_story_spec}',
        limit:30
      },adsToken);
      const ads=(res.data||[]).filter(a=>a.status!=='DELETED');
      if(!ads.length){ this.anuncios=[]; this.renderCriativos(); return; }

      // Insights de ads em uma chamada (nível ad)
      let adIns={};
      try {
        const insRes=await metaGet('/'+MKT.config.adAccount+'/insights',{
          fields:'ad_id,spend,impressions,clicks,ctr,cpm,cpc,actions,reach',
          level:'ad', limit:50, ...pp
        },adsToken);
        (insRes.data||[]).forEach(d=>{ adIns[d.ad_id]=d; });
      }catch(e2){
        // fallback: sem insights de anúncios
        console.warn('ad insights fallback:', e2.message);
      }

      const withIns=ads.map(a=>{
        const d=adIns[a.id]||{};
        const conv=(d.actions||[]).find(x=>x.action_type&&(x.action_type.includes('messaging')||x.action_type.includes('lead')));
        // Garante thumbnail
        const thumb = a.creative?.thumbnail_url ||
          a.creative?.object_story_spec?.video_data?.image_url ||
          a.creative?.object_story_spec?.link_data?.picture || null;
        return {...a,
          creative:{...a.creative, thumbnail_url: thumb},
          spend:parseFloat(d.spend||0), impressions:parseInt(d.impressions||0),
          clicks:parseInt(d.clicks||0), reach:parseInt(d.reach||0),
          ctr:parseFloat(d.ctr||0), cpm:parseFloat(d.cpm||0), cpc:parseFloat(d.cpc||0),
          leads:parseInt(conv?.value||0)
        };
      });

      this.anuncios=withIns;
      this.renderCriativos();
      console.log(`🎨 ${withIns.length} anúncios carregados · ${withIns.filter(a=>a.creative?.thumbnail_url).length} com thumbnail`);
    } catch(e){
      console.error('_carregarAnuncios:',e.message);
      this.anuncios=[];
      this.renderCriativos();
    }
  },

  async _carregarDemographics() {
    const adsToken=MKT.config.adsToken||MKT.config.token;
    if(!adsToken||!MKT.config.adAccount)return;
    const pp=this.getPeriodParams();
    try {
      const [rG,rA]=await Promise.all([
        metaGet('/'+MKT.config.adAccount+'/insights',{fields:'impressions',breakdowns:'gender',...pp},adsToken),
        metaGet('/'+MKT.config.adAccount+'/insights',{fields:'impressions',breakdowns:'age',...pp},adsToken)
      ]);
      const gd=rG.data||[];
      if(gd.length){
        const m=parseInt(gd.find(d=>d.gender==='male')?.impressions||0);
        const f=parseInt(gd.find(d=>d.gender==='female')?.impressions||0);
        buildDonut('chart-genero','leg-genero',['♂ Masc.','♀ Fem.'],[m,f],['rgba(37,99,235,.85)','rgba(225,48,108,.85)']);
      }
      const ad=(rA.data||[]).map(d=>({a:d.age,v:parseInt(d.impressions||0)})).sort((a,b)=>b.v-a.v).slice(0,5);
      if(ad.length){
        const C=['rgba(139,92,246,.85)','rgba(6,182,212,.85)','rgba(5,150,105,.85)','rgba(245,158,11,.85)','rgba(239,68,68,.85)'];
        buildDonut('chart-etaria','leg-etaria',ad.map(d=>d.a),ad.map(d=>d.v),C);
      }
    }catch(e){console.log('demographics:',e.message);}
  },

  async _carregarIgTipos() {
    if(!MKT.config.igId||!MKT.config.token)return;
    try {
      const res=await metaGet('/'+MKT.config.igId+'/media',{fields:'media_type',limit:60});
      const t={IMAGE:0,VIDEO:0,CAROUSEL_ALBUM:0};
      (res.data||[]).forEach(p=>{const k=p.media_type||'IMAGE';if(t[k]!==undefined)t[k]++;else t.IMAGE++;});
      buildDonut('dash-chart-ig-tipos','dash-ig-tipos-legend',['📷 Img','🎬 Vídeo','🎠 Caross.'],[t.IMAGE,t.VIDEO,t.CAROUSEL_ALBUM]);
    }catch(e){}
  },

  // ── Render tudo com filtro aplicado ───────
  renderTudo() {
    const camps=this.filtro?this.campanhas.filter(c=>c.id===this.filtro):this.campanhas;
    this.renderKPIs(camps);
    this.renderFunil(camps);
    this.renderGauges(camps);
    this.renderPizza(camps);
    this.renderLinha();
    this.renderBarras();
    this.renderROI(camps);
    this.renderCriativos();
    // Novas features
    renderHealthScore(camps);
    renderComparativo(camps);
    const now=new Date();
    const el=document.getElementById('dash-last-update');
    if(el)el.textContent='Atualizado '+now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
  },

  renderKPIs(camps) {
    const spend=camps.reduce((s,c)=>s+c.spend,0);
    const reach=camps.reduce((s,c)=>s+c.reach,0);
    const impr=camps.reduce((s,c)=>s+c.impressions,0);
    const leads=camps.reduce((s,c)=>s+c.leads,0);
    const cpmArr=camps.filter(c=>c.cpm>0);
    const cpcArr=camps.filter(c=>c.cpc>0);
    const cpm=cpmArr.length?cpmArr.reduce((s,c)=>s+c.cpm,0)/cpmArr.length:0;
    const cpc=cpcArr.length?cpcArr.reduce((s,c)=>s+c.cpc,0)/cpcArr.length:0;
    const roi=this.roi;
    let rec=0; camps.forEach(c=>{const r=roi[c.id]||{};rec+=(r.vendas||0)*(r.ticket||0);});
    const roas=spend>0&&rec>0?(rec/spend).toFixed(2)+'x':'—';
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    const hasCamps = camps.length > 0;
    set('dk-invest', hasCamps ? (spend>0 ? 'R$ '+spend.toFixed(2) : 'R$ 0,00') : '—');
    set('dk-alcance', hasCamps ? (reach>0 ? mktFmt(reach) : '0') : '—');
    set('dk-impr',    hasCamps ? (impr>0  ? mktFmt(impr)  : '0') : '—');
    set('dk-leads',   hasCamps ? String(leads) : '—');
    set('dk-cpm',     cpm>0 ? 'R$ '+cpm.toFixed(2) : '—');
    set('dk-cpc',     cpc>0 ? 'R$ '+cpc.toFixed(2) : '—');
    set('dk-roas',    roas);
    set('gauge-roas-val',roas);
    set('dk-receita', rec>0 ? 'R$ '+rec.toFixed(2) : 'R$ —');
    const roiG=spend>0&&rec>0?((rec-spend)/spend*100).toFixed(0)+'%':'—';
    const roiEl=document.getElementById('dk-roi-geral');
    if(roiEl){roiEl.textContent=roiG;roiEl.style.color=rec>spend?'var(--success)':'var(--danger)';}
    // Debug info
    const updEl=document.getElementById('dash-last-update');
    if(updEl&&hasCamps){
      const now=new Date();
      const withData=camps.filter(c=>c.spend>0||c.impressions>0).length;
      updEl.textContent=`${camps.length} camp. · ${withData} com dados · ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    }
    return {spend,impr,leads,cpm,roas,rec};
  },

  renderFunil(camps) {
    const el=document.getElementById('dash-funil'); if(!el)return;
    const impr=camps.reduce((s,c)=>s+c.impressions,0);
    const clk=camps.reduce((s,c)=>s+c.clicks,0);
    const leads=camps.reduce((s,c)=>s+c.leads,0);
    if(!impr){el.innerHTML='<div style="color:var(--muted);font-size:11px;text-align:center;padding:16px">Sem dados no período</div>';return;}
    const steps=[
      {l:'Impressões',v:impr,pct:100,c:'#2563eb'},
      {l:'Cliques',v:clk,pct:impr>0?+(clk/impr*100).toFixed(2):0,c:'#8b5cf6'},
      {l:'Leads',v:leads,pct:clk>0?+(leads/clk*100).toFixed(2):0,c:'#059669'}
    ];
    el.innerHTML=steps.map((s,i)=>`<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:10px">
        <span style="color:var(--muted)">${s.l}</span>
        <span style="font-weight:700">${mktFmt(s.v)} <span style="color:${s.c};font-size:9px">${i>0?'('+s.pct+'%)':''}</span></span>
      </div>
      <div style="height:22px;background:var(--surface2);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${Math.max(2,i===0?100:Math.min(s.pct*15,100))}%;background:${s.c};border-radius:5px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;transition:width .8s">
          <span style="font-size:9px;font-weight:700;color:#fff">${s.pct}%</span>
        </div>
      </div>
    </div>`).join('');
  },

  renderGauges(camps) {
    const clk=camps.reduce((s,c)=>s+c.clicks,0);
    const leads=camps.reduce((s,c)=>s+c.leads,0);
    const spend=camps.reduce((s,c)=>s+c.spend,0);
    const taxa=clk>0&&leads>0?(leads/clk*100):0;
    const roi=this.roi;
    let rec=0; camps.forEach(c=>{const r=roi[c.id]||{};rec+=(r.vendas||0)*(r.ticket||0);});
    const roas=spend>0&&rec>0?(rec/spend):0;
    const taxaEl=document.getElementById('gauge-taxa-val');
    if(taxaEl)taxaEl.textContent=taxa>0?taxa.toFixed(1)+'%':'—';
    this._drawGauge('gauge-taxa',Math.min(taxa*10,100),['#047857','#059669','#10b981']);
    this._drawGauge('gauge-roas',Math.min((roas/5)*100,100),['#7c3aed','#8b5cf6','#06b6d4']);
  },

  _drawGauge(id,pct,colors) {
    const c=document.getElementById(id); if(!c)return;
    const ctx=c.getContext('2d'),w=c.width,h=c.height,cx=w/2,cy=h-4,r=Math.min(w,h*2)/2-6;
    ctx.clearRect(0,0,w,h);
    ctx.beginPath();ctx.arc(cx,cy,r,Math.PI,0);ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=8;ctx.stroke();
    if(pct>0){
      const a=Math.PI+(Math.PI*Math.min(Math.max(pct/100,0),1));
      const g=ctx.createLinearGradient(0,0,w,0);
      (colors||['#7c3aed','#06b6d4']).forEach((c,i,a2)=>g.addColorStop(i/(a2.length-1||1),c));
      ctx.beginPath();ctx.arc(cx,cy,r,Math.PI,a);ctx.strokeStyle=g;ctx.lineWidth=8;ctx.lineCap='round';ctx.stroke();
    }
  },

  renderPizza(camps) {
    const d=camps.filter(c=>c.spend>0).slice(0,7);
    if(!d.length)return;
    buildDonut('chart-pizza','leg-pizza',d.map(c=>c.name.replace(/\[.*?\]\s*/g,'').slice(0,18)),d.map(c=>c.spend));
  },

  renderLinha() {
    const ctx=document.getElementById('chart-linha'); if(!ctx)return;
    const camps=this.filtro?this.campanhas.filter(c=>c.id===this.filtro):this.campanhas;
    const m=this.metricLinha;
    const d=camps.filter(c=>c[m]>0).slice(0,10);
    if(!d.length)return;
    const COLORS=['#8b5cf6','#2563eb','#059669','#f59e0b','#ef4444','#06b6d4','#ec4899','#10b981','#f97316','#6366f1'];
    const K='_ch_linha'; if(window[K])window[K].destroy();
    window[K]=new Chart(ctx,{type:'line',data:{
      labels:d.map(c=>c.name.replace(/\[.*?\]\s*/g,'').slice(0,13)),
      datasets:[{label:m,data:d.map(c=>c[m]),borderColor:'rgba(139,92,246,.9)',
        backgroundColor:'rgba(139,92,246,.07)',borderWidth:2,pointRadius:4,
        pointBackgroundColor:d.map((_,i)=>COLORS[i%COLORS.length]),
        pointBorderColor:'var(--surface)',pointBorderWidth:2,fill:true,tension:.4}]
    },options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#0f0f1a',titleColor:'#f0f0f8',bodyColor:'#6b6b90',
        callbacks:{label:c=>m==='spend'?'R$ '+c.raw.toFixed(2):m==='ctr'?c.raw.toFixed(2)+'%':mktFmt(c.raw)}}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#6b6b90',font:{size:9},maxRotation:30}},
        y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#6b6b90',font:{size:9},
          callback:v=>m==='spend'?'R$'+v:m==='ctr'?v+'%':mktFmt(v)},beginAtZero:true}}}});
  },

  renderBarras() {
    const ctx=document.getElementById('chart-barras'); if(!ctx)return;
    const camps=this.filtro?this.campanhas.filter(c=>c.id===this.filtro):this.campanhas;
    const m=this.metricBarras;
    const d=camps.filter(c=>c[m]>0).slice(0,8);
    if(!d.length)return;
    const C=['rgba(139,92,246,.85)','rgba(37,99,235,.85)','rgba(5,150,105,.85)','rgba(245,158,11,.85)',
      'rgba(239,68,68,.85)','rgba(6,182,212,.85)','rgba(236,72,153,.85)','rgba(16,185,129,.85)'];
    const K='_ch_barras'; if(window[K])window[K].destroy();
    window[K]=new Chart(ctx,{type:'bar',data:{
      labels:d.map(c=>c.name.replace(/\[.*?\]\s*/g,'').slice(0,13)),
      datasets:[{label:m,data:d.map(c=>c[m]),backgroundColor:C,borderRadius:6,borderSkipped:false}]
    },options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#0f0f1a',titleColor:'#f0f0f8',bodyColor:'#6b6b90',
        callbacks:{label:c=>m==='ctr'?c.raw.toFixed(2)+'%':'R$ '+c.raw.toFixed(2)}}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#6b6b90',font:{size:9},maxRotation:30}},
        y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#6b6b90',font:{size:9},
          callback:v=>m==='ctr'?v+'%':'R$'+v},beginAtZero:true}}}});
  },

  renderROI(camps) {
    const el=document.getElementById('dash-roi-list'); if(!el)return;
    const roi=this.roi;
    const active=camps.filter(c=>c.spend>0).slice(0,8);
    if(!active.length){el.innerHTML='<div style="color:var(--muted);font-size:11px;text-align:center;padding:12px">Sem campanhas com investimento</div>';return;}
    el.innerHTML=active.map(c=>{
      const r=roi[c.id]||{};
      const rec=(r.vendas||0)*(r.ticket||0);
      const roiPct=c.spend>0&&rec>0?((rec-c.spend)/c.spend*100).toFixed(0)+'%':'—';
      const rc=rec>c.spend?'var(--success)':rec>0?'var(--danger)':'var(--muted)';
      return `<div style="display:flex;align-items:center;gap:5px;padding:5px 7px;background:var(--surface2);border-radius:7px;font-size:10px">
        <div style="flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px" title="${c.name}">${c.name.replace(/\[.*?\]\s*/g,'').slice(0,20)}</div>
        <span style="color:var(--fin);font-family:monospace;flex-shrink:0">R$${c.spend.toFixed(0)}</span>
        <input type="number" placeholder="Vend." value="${r.vendas||''}" min="0"
          onchange="DS.roi['${c.id}']={...DS.roi['${c.id}'],vendas:+this.value||0};DS.renderROI(DS.filtro?DS.campanhas.filter(c=>c.id===DS.filtro):DS.campanhas);DS.renderKPIs(DS.filtro?DS.campanhas.filter(c=>c.id===DS.filtro):DS.campanhas)"
          style="width:44px;font-size:10px;background:var(--surface);border:1px solid var(--border2);border-radius:5px;padding:2px 4px;color:var(--text);text-align:center;outline:none">
        <input type="number" placeholder="R$tick" value="${r.ticket||''}" min="0"
          onchange="DS.roi['${c.id}']={...DS.roi['${c.id}'],ticket:+this.value||0};DS.renderROI(DS.filtro?DS.campanhas.filter(c=>c.id===DS.filtro):DS.campanhas);DS.renderKPIs(DS.filtro?DS.campanhas.filter(c=>c.id===DS.filtro):DS.campanhas)"
          style="width:50px;font-size:10px;background:var(--surface);border:1px solid var(--border2);border-radius:5px;padding:2px 4px;color:var(--text);text-align:center;outline:none">
        <span style="font-weight:800;color:${rc};min-width:30px;text-align:right">${roiPct}</span>
      </div>`;
    }).join('');
  },

  renderCriativos() {
    const el=document.getElementById('dash-criativos'); if(!el)return;
    const info=document.getElementById('dash-criat-info');
    const ads=this.filtro?this.anuncios.filter(a=>a.campaign_id===this.filtro):this.anuncios;
    if(!ads.length){
      el.innerHTML='<div style="color:var(--muted);font-size:11px;text-align:center;padding:20px;grid-column:1/-1">Aguardando carregamento...</div>';
      return;
    }
    if(info)info.textContent=ads.length+' anúncios';
    el.innerHTML=ads.slice(0,12).map((a,i)=>{
      const thumb=a.creative?.thumbnail_url;
      const nome=(a.name||'Anúncio').replace(/\[.*?\]\s*/g,'').slice(0,22);
      const hasData=a.impressions>0||a.spend>0;
      return `<div onclick="DS.abrirCriativo(${i})" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;transition:all .2s"
        onmouseover="this.style.borderColor='var(--accent)';this.style.transform='translateY(-2px)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.transform=''">
        <div style="height:85px;background:var(--surface);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center">
          ${thumb?`<img src="${thumb}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.querySelector('.fallback').style.display='flex';this.style.display='none'"><div class="fallback" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;font-size:28px">🎨</div>`:'<div style="font-size:28px">🎨</div>'}
          <div style="position:absolute;inset:0;background:linear-gradient(transparent 55%,rgba(0,0,0,.75))"></div>
          <div style="position:absolute;top:5px;right:5px;font-size:8px;padding:2px 5px;border-radius:4px;font-weight:700;${a.status==='ACTIVE'?'background:rgba(5,150,105,.85);color:#fff':'background:rgba(245,158,11,.85);color:#fff'}">${a.status==='ACTIVE'?'ATIVO':'PAUSADO'}</div>
        </div>
        <div style="padding:7px">
          <div style="font-size:9px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:5px">${nome}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px">
            <div style="background:rgba(37,99,235,.1);border-radius:4px;padding:3px;text-align:center">
              <div style="font-size:10px;font-weight:800;color:${hasData?'#60a5fa':'var(--muted)'}">${hasData?mktFmt(a.impressions):'—'}</div>
              <div style="font-size:7px;color:var(--muted)">Imp.</div>
            </div>
            <div style="background:rgba(139,92,246,.1);border-radius:4px;padding:3px;text-align:center">
              <div style="font-size:10px;font-weight:800;color:${hasData?'#a78bfa':'var(--muted)'}">${hasData?mktFmt(a.clicks):'—'}</div>
              <div style="font-size:7px;color:var(--muted)">Cliques</div>
            </div>
            <div style="background:rgba(245,158,11,.1);border-radius:4px;padding:3px;text-align:center">
              <div style="font-size:10px;font-weight:800;color:${hasData?'#fbbf24':'var(--muted)'}">${hasData&&a.ctr>0?a.ctr.toFixed(1)+'%':'—'}</div>
              <div style="font-size:7px;color:var(--muted)">CTR</div>
            </div>
            <div style="background:rgba(5,150,105,.1);border-radius:4px;padding:3px;text-align:center">
              <div style="font-size:10px;font-weight:800;color:${a.leads>0?'#34d399':'var(--muted)'}">${a.leads||'0'}</div>
              <div style="font-size:7px;color:var(--muted)">Leads</div>
            </div>
          </div>
          ${a.spend>0?`<div style="margin-top:4px;text-align:right;font-size:8px;color:var(--fin)">R$ ${a.spend.toFixed(2)}</div>`:''}
        </div>
      </div>`;
    }).join('');
  },

  abrirCriativo(idx) {
    const ads=this.filtro?this.anuncios.filter(a=>a.campaign_id===this.filtro):this.anuncios;
    const a=ads[idx]; if(!a)return;
    const camp=this.campanhas.find(c=>c.id===a.campaign_id);
    const thumb=a.creative?.thumbnail_url;
    const nome=(a.name||'Anúncio').replace(/\[.*?\]\s*/g,'');
    const cpl=a.leads>0&&a.spend>0?'R$ '+(a.spend/a.leads).toFixed(2):'—';
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set('crit-nome',nome); set('crit-camp',camp?camp.name.replace(/\[.*?\]\s*/g,'').slice(0,40):'—');
    set('crit-status',a.status||'—');
    set('crit-impr',a.impressions>0?mktFmt(a.impressions):'—');
    set('crit-clicks',a.clicks>0?mktFmt(a.clicks):'—');
    set('crit-ctr',a.ctr>0?a.ctr.toFixed(2)+'%':'—');
    set('crit-cpm',a.cpm>0?'R$ '+a.cpm.toFixed(2):'—');
    set('crit-cpc',a.cpc>0?'R$ '+a.cpc.toFixed(2):'—');
    set('crit-spend',a.spend>0?'R$ '+a.spend.toFixed(2):'—');
    set('crit-leads',String(a.leads||0)); set('crit-cpl',cpl);
    set('crit-reach',a.reach>0?mktFmt(a.reach):'—');
    const img=document.getElementById('crit-thumb');
    if(img){img.src=thumb||'';img.style.display=thumb?'block':'none';}
    const icon=document.getElementById('crit-icon');
    if(icon)icon.style.display=thumb?'none':'block';
    openModal('modal-criativo');
  },

  salvarROI() {
    localStorage.setItem('dm_ads_resultados',JSON.stringify(this.roi));
    const btn=document.querySelector('[onclick="DS.salvarROI()"]');
    if(btn){btn.textContent='✅';setTimeout(()=>btn.textContent='💾',1500);}
  }
};

// Carrega ROI salvo do localStorage
(function(){
  const saved=JSON.parse(localStorage.getItem('dm_ads_resultados')||'{}');
  Object.assign(DS.roi,saved);
})();

// Shims para compatibilidade com código legado
function dashCarregarTudo(){return DS.carregar();}
function dashSetPeriod(p,btn){return DS.setPeriod(p,btn);}
function dashSetView(){}
function dashSetMetricLinha(m,btn){return DS.setMetricLinha(m,btn);}
function dashSetMetricBarras(m,btn){return DS.setMetricBarras(m,btn);}
function dashFilterCampanha(id){return DS.setFiltro(id);}
function dashLoadCreativos(){return DS.renderCriativos();}
function dashLoadIgBreakdown(c,l){return DS._carregarIgTipos();}
function dashLoadDemographics(){return DS._carregarDemographics();}
function dashDrawGauge(id,p,c){return DS._drawGauge(id,p,c);}
let _dashCampsData=[];
let DASH_VIEW='geral',DASH_PLAT='all';

const ADS_RESULTADOS = {};

// ══════════════════════════════════════════════
// HEALTH SCORE — Semáforo de campanhas
// ══════════════════════════════════════════════
function calcHealthScore(c) {
  // Benchmarks Meta Brasil 2024 (médios)
  const bench = { ctr: 1.5, cpm: 25, cpc: 2.0 };
  let score = 100, flags = [];

  if(c.ctr > 0) {
    if(c.ctr < bench.ctr * 0.5)      { score -= 30; flags.push({t:'CTR muito baixo ('+c.ctr.toFixed(2)+'%)',s:'danger'}); }
    else if(c.ctr < bench.ctr)        { score -= 10; flags.push({t:'CTR abaixo da média ('+c.ctr.toFixed(2)+'%)',s:'warn'}); }
    else                               {              flags.push({t:'CTR saudável ('+c.ctr.toFixed(2)+'%)',s:'ok'}); }
  }
  if(c.cpm > 0) {
    if(c.cpm > bench.cpm * 2)         { score -= 25; flags.push({t:'CPM alto (R$ '+c.cpm.toFixed(2)+')',s:'danger'}); }
    else if(c.cpm > bench.cpm * 1.3)  { score -= 10; flags.push({t:'CPM acima da média (R$ '+c.cpm.toFixed(2)+')',s:'warn'}); }
    else                               {              flags.push({t:'CPM eficiente (R$ '+c.cpm.toFixed(2)+')',s:'ok'}); }
  }
  if(c.cpc > 0) {
    if(c.cpc > bench.cpc * 2.5)       { score -= 20; flags.push({t:'CPC elevado (R$ '+c.cpc.toFixed(2)+')',s:'danger'}); }
    else if(c.cpc > bench.cpc * 1.5)  { score -= 8;  flags.push({t:'CPC acima do ideal (R$ '+c.cpc.toFixed(2)+')',s:'warn'}); }
    else                               {              flags.push({t:'CPC eficiente (R$ '+c.cpc.toFixed(2)+')',s:'ok'}); }
  }
  if(c.spend === 0 && c.status !== 'ACTIVE') { score -= 15; flags.push({t:'Campanha pausada/sem dados',s:'warn'}); }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 80 ? {label:'🟢 Saudável', color:'var(--success)', bg:'rgba(16,185,129,.12)'}
              : score >= 55 ? {label:'🟡 Atenção',  color:'var(--fin)',     bg:'rgba(245,158,11,.12)'}
              :               {label:'🔴 Crítico',   color:'var(--danger)',  bg:'rgba(239,68,68,.12)'};
  return { score, grade, flags };
}

function renderHealthScore(camps) {
  const wrap = document.getElementById('dash-health-wrap');
  const list = document.getElementById('dash-health-list');
  const overall = document.getElementById('dash-health-overall');
  if(!wrap||!list||!overall) return;

  const active = camps.filter(c => c.spend > 0 || c.impressions > 0);
  if(!active.length) { wrap.style.display='none'; return; }
  wrap.style.display = 'block';

  const avgScore = Math.round(active.reduce((s,c)=>s+calcHealthScore(c).score,0)/active.length);
  const og = avgScore>=80?{l:'🟢 Geral Saudável',c:'var(--success)',bg:'rgba(16,185,129,.15)'}
           : avgScore>=55?{l:'🟡 Atenção Geral', c:'var(--fin)',    bg:'rgba(245,158,11,.15)'}
           :              {l:'🔴 Crítico',        c:'var(--danger)', bg:'rgba(239,68,68,.15)'};
  overall.textContent = og.l + ' · ' + avgScore + '/100';
  overall.style.background = og.bg;
  overall.style.color = og.c;

  list.innerHTML = active.slice(0,8).map(c => {
    const h = calcHealthScore(c);
    const barW = h.score;
    return `<div style="background:var(--surface2);border-radius:8px;padding:10px 12px;border:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:12px;font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.name}">${c.name.replace(/\[.*?\]\s*/g,'').slice(0,30)}</span>
        <span style="font-size:11px;font-weight:800;color:${h.grade.color};background:${h.grade.bg};padding:2px 8px;border-radius:10px;white-space:nowrap">${h.grade.label} ${h.score}/100</span>
      </div>
      <div style="height:5px;background:var(--border2);border-radius:3px;overflow:hidden;margin-bottom:7px">
        <div style="height:100%;width:${barW}%;background:${h.grade.color};border-radius:3px;transition:width .6s ease"></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${h.flags.slice(0,3).map(f=>{
          const fc=f.s==='ok'?'var(--success)':f.s==='warn'?'var(--fin)':'var(--danger)';
          const fb=f.s==='ok'?'rgba(16,185,129,.1)':f.s==='warn'?'rgba(245,158,11,.1)':'rgba(239,68,68,.1)';
          return `<span style="font-size:10px;color:${fc};background:${fb};padding:2px 7px;border-radius:6px">${f.t}</span>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
// COMPARATIVO DE PERÍODOS
// ══════════════════════════════════════════════
async function renderComparativo(camps) {
  const wrap = document.getElementById('dash-compare-wrap');
  const grid = document.getElementById('dash-compare-grid');
  const label = document.getElementById('dash-compare-label');
  if(!wrap||!grid) return;
  if(!camps.length) { wrap.style.display='none'; return; }

  const adsToken = MKT.config.adsToken || MKT.config.token;
  if(!adsToken) { wrap.style.display='none'; return; }

  // Calcula período anterior equivalente
  const pp = DS.getPeriodParams();
  let prevPreset = null, prevRange = null;
  if(DS.preset && !DS.dateFrom) {
    const map = { 'last_7d':'last_14d', 'last_30d':'last_60d', 'last_90d':'last_180d', 'last_14d':'last_28d', 'last_60d':'last_90d' };
    prevPreset = map[DS.preset];
    if(!prevPreset) { wrap.style.display='none'; return; }
    if(label) label.textContent = DS.preset + ' vs período anterior';
  } else if(DS.dateFrom && DS.dateTo) {
    const from = new Date(DS.dateFrom), to = new Date(DS.dateTo);
    const diff = to - from;
    const prevTo = new Date(from - 86400000);
    const prevFrom = new Date(prevTo - diff);
    prevRange = { since: prevFrom.toISOString().slice(0,10), until: prevTo.toISOString().slice(0,10) };
    if(label) label.textContent = DS.dateFrom+'→'+DS.dateTo + ' vs ' + prevRange.since+'→'+prevRange.until;
  } else { wrap.style.display='none'; return; }

  wrap.style.display = 'block';
  grid.innerHTML = '<div style="color:var(--muted);font-size:11px;grid-column:1/-1;text-align:center;padding:8px">⏳ Calculando comparativo...</div>';

  try {
    const prevPP = prevPreset ? {date_preset: prevPreset} : {time_range: JSON.stringify(prevRange)};
    // Busca totais do período anterior para todas as campanhas
    const prevResults = await Promise.all(
      camps.slice(0,6).map(c => DS._insightsCampanha(c, prevPP, adsToken))
    );

    const cur  = { spend:0, impressions:0, clicks:0, leads:0 };
    const prev = { spend:0, impressions:0, clicks:0, leads:0 };
    camps.forEach(c => { cur.spend+=c.spend; cur.impressions+=c.impressions; cur.clicks+=c.clicks; cur.leads+=c.leads; });
    prevResults.forEach(c => { prev.spend+=c.spend; prev.impressions+=c.impressions; prev.clicks+=c.clicks; prev.leads+=c.leads; });

    const metrics = [
      { label:'Investido',    cur:cur.spend,       prev:prev.spend,       fmt:v=>'R$ '+v.toFixed(2), inv:true },
      { label:'Impressões',   cur:cur.impressions,  prev:prev.impressions,  fmt:v=>mktFmt(v) },
      { label:'Cliques',      cur:cur.clicks,       prev:prev.clicks,       fmt:v=>mktFmt(v) },
      { label:'Leads',        cur:cur.leads,        prev:prev.leads,        fmt:v=>String(v) },
    ];

    grid.innerHTML = metrics.map(m => {
      const diff = prev[m.label] !== undefined ? 0 : 0; // placeholder
      const pct  = m.prev > 0 ? ((m.cur - m.prev) / m.prev * 100) : null;
      const up   = pct !== null ? (m.inv ? pct < 0 : pct > 0) : null;
      const arrow = pct === null ? '' : (pct > 0 ? '▲' : '▼');
      const pctColor = up === null ? 'var(--muted)' : up ? 'var(--success)' : 'var(--danger)';
      return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px">${m.label}</div>
        <div style="font-size:18px;font-weight:900;font-family:'Outfit',sans-serif">${m.fmt(m.cur)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${m.fmt(m.prev)} ant.</div>
        ${pct !== null ? `<div style="font-size:12px;font-weight:700;color:${pctColor};margin-top:4px">${arrow} ${Math.abs(pct).toFixed(1)}%</div>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = `<div style="color:var(--danger);font-size:11px;grid-column:1/-1;text-align:center;padding:8px">Erro ao buscar comparativo: ${e.message}</div>`;
  }
}

// ══════════════════════════════════════════════
// WEBHOOK / SYNC AUTOMÁTICO
// ══════════════════════════════════════════════
const WH = {
  timer: null,
  running: false,
  interval: 5 * 60 * 1000, // 5 min
  lastSync: null,

  setStatus(ok, text) {
    const el = document.getElementById('webhook-status');
    if(!el) return;
    const c = ok ? 'var(--success)' : this.running ? 'var(--accent2)' : 'var(--muted)';
    el.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:${c};display:inline-block;${this.running?'animation:pulse 1.5s infinite':''}"></span> ${text}`;
    const last = document.getElementById('webhook-last-sync');
    if(last && this.lastSync) last.textContent = 'Último: ' + this.lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  },

  async sync() {
    if(this.running) return;
    if(!MKT.config.token) { this.setStatus(false,'Sem token'); return; }
    this.running = true;
    this.setStatus(true,'Sincronizando...');
    try {
      await DS.carregar();
      this.lastSync = new Date();
      this.setStatus(true, 'Sincronizado ✓');
      // Persiste snapshot no Supabase se possível
      if(S.user && DS.campanhas.length) {
        const snap = DS.campanhas.filter(c=>c.spend>0||c.impressions>0).map(c=>({
          user_id: S.user.id,
          campaign_id: c.id,
          ad_account_id: MKT.config.adAccount,
          name: c.name,
          status: c.status,
          spend_30d: c.spend,
          reach_30d: c.reach,
          clicks_30d: c.clicks,
          results_30d: c.leads,
          cpa: c.leads>0&&c.spend>0 ? c.spend/c.leads : null,
          raw_json: c,
          synced_at: new Date().toISOString()
        }));
        try {
          await sb.from('mkt_campaigns').upsert(snap, {onConflict:'campaign_id'});
        } catch(e2) { /* tabela pode não existir ainda */ }
      }
    } catch(e) {
      this.setStatus(false,'Erro: '+e.message.slice(0,30));
    } finally {
      this.running = false;
      setTimeout(()=>this.setStatus(!!this.timer, this.timer?'Auto ativo':'Inativo'), 3000);
    }
  },

  startAuto() {
    if(this.timer) return;
    this.timer = setInterval(()=>this.sync(), this.interval);
    this.setStatus(true, 'Auto ativo (5min)');
    const btn = document.getElementById('webhook-auto-btn');
    if(btn){ btn.textContent='⏸ Parar Auto'; btn.style.color='var(--accent2)'; btn.style.borderColor='var(--accent2)'; }
    this.sync();
  },

  stopAuto() {
    clearInterval(this.timer); this.timer = null;
    this.setStatus(false,'Inativo');
    const btn = document.getElementById('webhook-auto-btn');
    if(btn){ btn.textContent='▶ Auto (5min)'; btn.style.color=''; btn.style.borderColor=''; }
  }
};

function webhookSyncNow() { WH.sync(); }
function webhookToggleAuto() { WH.timer ? WH.stopAuto() : WH.startAuto(); }

// Adiciona estilo de pulse para o dot
(()=>{
  const s = document.createElement('style');
  s.textContent = `@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`;
  document.head.appendChild(s);
})();

function adsSetPeriod(period, btn) {
  ADS_PERIOD = period;
  ADS_DATE_FROM = null;
  ADS_DATE_TO = null;
  document.querySelectorAll('[id^=adsbtn-]').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const df=document.getElementById('ads-date-from'); if(df) df.value='';
  const dt=document.getElementById('ads-date-to');   if(dt) dt.value='';
  mktLoadAds();
}

async function mktLoadAds(){
  const listEl = document.getElementById('mkt-ads-list');
  if(!MKT.config.adAccount) MKT.config.adAccount = 'act_374471102656220';
  const adsToken = MKT.config.adsToken || MKT.config.token;
  if(!adsToken){
    listEl.innerHTML='<div style="color:var(--fin);font-size:13px;text-align:center;padding:32px">⚠️ Configure o Token de Usuário (Ads) em Config META → seção Token Permanente.</div>';
    return;
  }
  listEl.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px">⏳ Buscando campanhas e métricas...</div>';

  try {
    const res = await metaGet('/'+MKT.config.adAccount+'/campaigns',{
      fields:'id,name,status,objective,start_time,stop_time',
      limit:30
    }, adsToken);
    const camps = res.data||[];
    if(!camps.length){
      listEl.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:32px">Nenhuma campanha encontrada.</div>';
      return;
    }

    // Determina período — data customizada tem prioridade
    const dateFrom = document.getElementById('ads-date-from')?.value;
    const dateTo   = document.getElementById('ads-date-to')?.value;
    const insightParams = (dateFrom && dateTo)
      ? { fields:'spend,reach,clicks,impressions,cpm,cpc,ctr,actions,action_values', time_range: JSON.stringify({since:dateFrom,until:dateTo}) }
      : { fields:'spend,reach,clicks,impressions,cpm,cpc,ctr,actions,action_values', date_preset: ADS_PERIOD||'last_30d' };

    // Busca insights completos por campanha
    const withIns = await Promise.all(camps.map(async c=>{
      try{
        const ins = await metaGet('/'+c.id+'/insights', insightParams, adsToken);
        const d = ins.data?.[0]||{};
        // Busca conversas/leads
        const conv = (d.actions||[]).find(a=>a.action_type&&(
          a.action_type.includes('messaging')||
          a.action_type.includes('whatsapp')||
          a.action_type.includes('lead')||
          a.action_type.includes('contact')||
          a.action_type==='complete_registration'
        ));
        const spend    = parseFloat(d.spend||0);
        const clicks   = parseInt(d.clicks||0);
        const impr     = parseInt(d.impressions||0);
        const cpm      = parseFloat(d.cpm||0);
        const cpc      = parseFloat(d.cpc||0);
        const ctr      = parseFloat(d.ctr||0);
        const leads    = parseInt(conv?.value||0);
        const cpl      = leads>0&&spend>0 ? spend/leads : 0;
        return{...c, spend, reach:parseInt(d.reach||0), clicks, impressions:impr, cpm, cpc, ctr, leads, cpl};
      }catch(e){
        return{...c, spend:0, reach:0, clicks:0, impressions:0, cpm:0, cpc:0, ctr:0, leads:0, cpl:0};
      }
    }));

    // KPIs globais
    const totSpend = withIns.reduce((s,c)=>s+c.spend,0);
    const totImpr  = withIns.reduce((s,c)=>s+c.impressions,0);
    const totClicks= withIns.reduce((s,c)=>s+c.clicks,0);
    const totLeads = withIns.reduce((s,c)=>s+c.leads,0);
    const avgCpm   = totImpr>0 ? (totSpend/totImpr)*1000 : 0;
    const avgCpc   = totClicks>0 ? totSpend/totClicks : 0;
    const avgCtr   = totImpr>0 ? (totClicks/totImpr)*100 : 0;
    const avgCpl   = totLeads>0 ? totSpend/totLeads : 0;

    // Atualiza KPIs
    const set = (id,v) => { const el=document.getElementById(id); if(el)el.textContent=v; };
    set('mk-spend',    'R$ '+totSpend.toFixed(2));
    set('mk-cpm',      avgCpm>0?'R$ '+avgCpm.toFixed(2):'—');
    set('mk-cpc-avg',  avgCpc>0?'R$ '+avgCpc.toFixed(2):'—');
    set('mk-ctr',      avgCtr>0?avgCtr.toFixed(2)+'%':'—');
    set('mk-cpa',      avgCpl>0?'R$ '+avgCpl.toFixed(2):'—');
    set('res-investimento', 'R$ '+totSpend.toFixed(2));

    // Carrega resultados salvos do localStorage
    const savedRes = JSON.parse(localStorage.getItem('dm_ads_resultados')||'{}');
    Object.assign(ADS_RESULTADOS, savedRes);

    // Calcula consolidado
    mktRecalcularConsolidado(withIns, totSpend);

    // Renderiza tabela
    const stCls={ACTIVE:'success',PAUSED:'fin',ARCHIVED:'muted',DELETED:'danger'};
    listEl.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:900px">
          <thead>
            <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:10px 12px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.8px;min-width:160px">Campanha</th>
              <th style="text-align:center;padding:10px 8px;color:var(--muted);font-size:10px;text-transform:uppercase">Status</th>
              <th style="text-align:right;padding:10px 8px;color:var(--fin);font-size:10px;text-transform:uppercase">Investido</th>
              <th style="text-align:right;padding:10px 8px;color:var(--muted);font-size:10px;text-transform:uppercase">Alcance</th>
              <th style="text-align:right;padding:10px 8px;color:var(--muted);font-size:10px;text-transform:uppercase">Impressões</th>
              <th style="text-align:right;padding:10px 8px;color:var(--muted);font-size:10px;text-transform:uppercase">CPM</th>
              <th style="text-align:right;padding:10px 8px;color:var(--muted);font-size:10px;text-transform:uppercase">CPC</th>
              <th style="text-align:right;padding:10px 8px;color:var(--accent);font-size:10px;text-transform:uppercase">CTR</th>
              <th style="text-align:right;padding:10px 8px;color:var(--muted);font-size:10px;text-transform:uppercase">Leads</th>
              <th style="text-align:right;padding:10px 8px;color:var(--muted);font-size:10px;text-transform:uppercase">CPL</th>
              <th style="text-align:center;padding:10px 8px;color:var(--success);font-size:10px;text-transform:uppercase" colspan="2">✏️ Manual</th>
              <th style="text-align:right;padding:10px 8px;color:var(--success);font-size:10px;text-transform:uppercase">Receita</th>
              <th style="text-align:right;padding:10px 8px;color:var(--success);font-size:10px;text-transform:uppercase">ROI</th>
            </tr>
            <tr style="background:var(--surface2);border-bottom:2px solid var(--border)">
              <th colspan="10"></th>
              <th style="text-align:center;padding:4px 8px;color:var(--success);font-size:10px">Vendas fechadas</th>
              <th style="text-align:center;padding:4px 8px;color:var(--success);font-size:10px">Ticket médio (R$)</th>
              <th colspan="2"></th>
            </tr>
          </thead>
          <tbody id="ads-table-body">
            ${withIns.map(c=>{
              const saved = ADS_RESULTADOS[c.id]||{};
              const vendas = saved.vendas||'';
              const ticket = saved.ticket||'';
              const receita = (parseFloat(vendas)||0)*(parseFloat(ticket)||0);
              const roi = receita>0&&c.spend>0 ? ((receita-c.spend)/c.spend*100).toFixed(0) : null;
              const roiColor = roi===null?'var(--muted)':parseFloat(roi)>=0?'var(--success)':'var(--danger)';
              return `<tr style="border-bottom:1px solid var(--border);transition:background .15s" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
                <td style="padding:10px 12px">
                  <div style="font-weight:600;font-size:12px">${c.name}</div>
                  <div style="font-size:10px;color:var(--muted)">${c.objective||'—'}</div>
                </td>
                <td style="padding:10px 8px;text-align:center"><span class="tag ${stCls[c.status]||'pendente'}" style="font-size:10px">${c.status}</span></td>
                <td style="padding:10px 8px;text-align:right;font-family:monospace;font-weight:700;color:var(--fin)">R$ ${c.spend.toFixed(2)}</td>
                <td style="padding:10px 8px;text-align:right;font-family:monospace">${mktFmt(c.reach)}</td>
                <td style="padding:10px 8px;text-align:right;font-family:monospace">${mktFmt(c.impressions)}</td>
                <td style="padding:10px 8px;text-align:right;font-family:monospace">${c.cpm>0?'R$ '+c.cpm.toFixed(2):'—'}</td>
                <td style="padding:10px 8px;text-align:right;font-family:monospace">${c.cpc>0?'R$ '+c.cpc.toFixed(2):'—'}</td>
                <td style="padding:10px 8px;text-align:right;font-family:monospace;color:var(--accent)">${c.ctr>0?c.ctr.toFixed(2)+'%':'—'}</td>
                <td style="padding:10px 8px;text-align:right;font-family:monospace">${c.leads||'—'}</td>
                <td style="padding:10px 8px;text-align:right;font-family:monospace">${c.cpl>0?'R$ '+c.cpl.toFixed(2):'—'}</td>
                <td style="padding:10px 8px;text-align:center">
                  <input type="number" min="0" placeholder="0"
                    value="${vendas}"
                    data-camp="${c.id}" data-field="vendas"
                    onchange="mktAtualizarResultado('${c.id}',this)"
                    style="width:70px;background:var(--surface);border:1px solid var(--border2);border-radius:6px;padding:5px 8px;color:var(--text);font-size:12px;text-align:center;outline:none"
                    onfocus="this.style.borderColor='var(--success)'" onblur="this.style.borderColor='var(--border2)'">
                </td>
                <td style="padding:10px 8px;text-align:center">
                  <input type="number" min="0" placeholder="0,00"
                    value="${ticket}"
                    data-camp="${c.id}" data-field="ticket"
                    onchange="mktAtualizarResultado('${c.id}',this)"
                    style="width:90px;background:var(--surface);border:1px solid var(--border2);border-radius:6px;padding:5px 8px;color:var(--text);font-size:12px;text-align:center;outline:none"
                    onfocus="this.style.borderColor='var(--success)'" onblur="this.style.borderColor='var(--border2)'">
                </td>
                <td style="padding:10px 8px;text-align:right;font-family:monospace;font-weight:700;color:var(--success)" id="receita-${c.id}">${receita>0?'R$ '+receita.toFixed(2):'—'}</td>
                <td style="padding:10px 8px;text-align:right;font-family:monospace;font-weight:800;color:${roiColor}" id="roi-${c.id}">${roi!==null?roi+'%':'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="padding:10px 14px;font-size:11px;color:var(--muted);border-top:1px solid var(--border);display:flex;gap:16px;flex-wrap:wrap">
        <span>📊 Dados da API META (30 últimos dias)</span>
        <span>✏️ Preencha "Vendas" e "Ticket Médio" para calcular receita e ROI por campanha</span>
        <span>💾 Clique em "Salvar Resultados" para persistir os dados</span>
      </div>`;

    // Guarda referência das campanhas para cálculos
    MKT._campaigns = withIns;
    // Render funil
    const funnImpr=withIns.reduce((s,c)=>s+(c.impressions||0),0);
    const funnClks=withIns.reduce((s,c)=>s+(c.clicks||0),0);
    const funnLeads=withIns.reduce((s,c)=>s+(c.leads||0),0);
    dashRenderFunnel({impressions:funnImpr,clicks:funnClks,leads:funnLeads});
    const taxa = funnClks>0&&funnLeads>0 ? (funnLeads/funnClks*100) : 0;
    const taxaEl=document.getElementById('dash-taxa-conv');
    if(taxaEl) taxaEl.textContent=taxa>0?taxa.toFixed(1)+'%':'—';
    dashRenderGauge(taxa);

  } catch(e){
    listEl.innerHTML=`<div style="color:var(--danger);font-size:13px;text-align:center;padding:24px">❌ ${e.message}</div>`;
  }
}

function mktAtualizarResultado(campId, input) {
  if(!ADS_RESULTADOS[campId]) ADS_RESULTADOS[campId] = {};
  ADS_RESULTADOS[campId][input.dataset.field] = parseFloat(input.value)||0;

  // Recalcula linha
  const res = ADS_RESULTADOS[campId];
  const receita = (res.vendas||0) * (res.ticket||0);
  const camp = (MKT._campaigns||[]).find(c=>c.id===campId);
  const spend = camp?.spend||0;
  const roi = receita>0&&spend>0 ? ((receita-spend)/spend*100).toFixed(0) : null;
  const roiColor = roi===null?'var(--muted)':parseFloat(roi)>=0?'var(--success)':'var(--danger)';

  const recEl = document.getElementById('receita-'+campId);
  const roiEl = document.getElementById('roi-'+campId);
  if(recEl) recEl.textContent = receita>0?'R$ '+receita.toFixed(2):'—';
  if(roiEl){ roiEl.textContent = roi!==null?roi+'%':'—'; roiEl.style.color=roiColor; }

  // Recalcula consolidado
  if(MKT._campaigns) mktRecalcularConsolidado(MKT._campaigns, MKT._campaigns.reduce((s,c)=>s+c.spend,0));
}

function mktRecalcularConsolidado(campaigns, totSpend) {
  let totReceita = 0;
  campaigns.forEach(c=>{
    const res = ADS_RESULTADOS[c.id]||{};
    totReceita += (res.vendas||0)*(res.ticket||0);
  });

  const lucro = totReceita - totSpend;
  const roi   = totSpend>0 ? ((lucro/totSpend)*100).toFixed(0) : null;
  const roas  = totSpend>0&&totReceita>0 ? (totReceita/totSpend).toFixed(2) : null;
  const roiColor = roi===null?'var(--muted)':parseFloat(roi)>=0?'var(--success)':'var(--danger)';

  const set = (id,v,color) => {
    const el=document.getElementById(id);
    if(el){ el.textContent=v; if(color)el.style.color=color; }
  };
  set('res-investimento', 'R$ '+totSpend.toFixed(2));
  set('res-receita',  totReceita>0?'R$ '+totReceita.toFixed(2):'R$ —', totReceita>0?'var(--success)':'var(--muted)');
  set('res-lucro',    totReceita>0?'R$ '+lucro.toFixed(2):'R$ —', lucro>=0?'var(--success)':'var(--danger)');
  set('res-roi',      roi!==null?roi+'%':'—', roiColor);
  set('mk-roas',      roas?roas+'x':'—', roas&&parseFloat(roas)>=1?'var(--success)':'var(--danger)');
}

function mktSalvarResultados() {
  localStorage.setItem('dm_ads_resultados', JSON.stringify(ADS_RESULTADOS));
  // Feedback visual no botão
  const btn = document.querySelector('[onclick="mktSalvarResultados()"]');
  if(btn){ const orig=btn.textContent; btn.textContent='✅ Salvo!'; btn.style.background='var(--success)'; setTimeout(()=>{btn.textContent=orig;btn.style.background='';},2000); }
}

// Agente Marketing — usa EDGE (Supabase function) igual ao resto do sistema
// com system prompt enriquecido com dados META e 6Ps

function mktUpdatePs(){ /* context updates on send */ }

function mktGetSystemPrompt(){
  const ps=[];
  if(document.getElementById('mkt6p-p1')?.checked) ps.push('P1-Propósito: A empresa existe para transformar negócios com tecnologia e inteligência digital.');
  if(document.getElementById('mkt6p-p3')?.checked) ps.push('P3-Personas: Empresários e gestores de PMEs (25-50 anos) que querem crescer digitalmente.');
  if(document.getElementById('mkt6p-p5')?.checked) ps.push('P5-Posicionamento: Diferencial = IA integrada + dados reais + execução humana.');
  if(document.getElementById('mkt6p-p2')?.checked) ps.push('P2-Produto: Gestão de tráfego, conteúdo, automação IA, consultoria digital.');
  if(document.getElementById('mkt6p-p6')?.checked) ps.push('P6-Performance: KPIs = CAC, LTV, ROAS>3x, NPS, Receita Recorrente.');

  const emp = S.empresa;
  const empCtx = emp ? `Empresa: ${emp.nome||'—'} | Setor: ${emp.setor||'—'} | Fase: ${emp.fase||'—'}` : '';

  // Dados META completos do DS (estado centralizado)
  const camps = DS.campanhas.filter(c=>c.spend>0||c.impressions>0);
  const totalSpend  = camps.reduce((s,c)=>s+c.spend,0);
  const totalImpr   = camps.reduce((s,c)=>s+c.impressions,0);
  const totalClicks = camps.reduce((s,c)=>s+c.clicks,0);
  const totalLeads  = camps.reduce((s,c)=>s+c.leads,0);
  const avgCPM = camps.length ? (camps.reduce((s,c)=>s+c.cpm,0)/camps.length).toFixed(2) : 0;
  const avgCPC = camps.length ? (camps.reduce((s,c)=>s+c.cpc,0)/camps.length).toFixed(2) : 0;
  const avgCTR = camps.length ? (camps.reduce((s,c)=>s+c.ctr,0)/camps.length).toFixed(2) : 0;
  const periodo = DS.dateFrom ? `${DS.dateFrom}→${DS.dateTo}` : (DS.preset||'máximo');
  const topCamps = [...camps].sort((a,b)=>b.spend-a.spend).slice(0,6)
    .map(c=>`  • ${c.name.replace(/\[.*?\]\s*/g,'').slice(0,28)}: R$${c.spend.toFixed(2)} | ${mktFmt(c.impressions)} impr. | CTR ${c.ctr.toFixed(2)}% | ${c.leads} leads`).join('\n');

  // Score de saúde
  const scores = camps.map(c=>calcHealthScore(c).score);
  const avgHealth = scores.length ? Math.round(scores.reduce((a,b)=>a+b)/scores.length) : null;

  // Dados orgânicos
  const fbFans  = document.getElementById('mk-fans')?.textContent||'—';
  const fbViews = document.getElementById('mk-views')?.textContent||'—';
  const fbEng   = document.getElementById('mk-eng')?.textContent||'—';
  const igUser  = document.getElementById('mk-ig-status')?.textContent?.replace('✅ ','').trim()||'—';
  const igFans  = document.getElementById('mk-ig-fans')?.textContent||'—';
  const igPosts = document.getElementById('mk-ig-posts')?.textContent||'—';
  const igLikes = document.getElementById('mk-ig-eng')?.textContent||'—';

  const adsCtx = camps.length > 0 ? `
═══ META ADS — PERÍODO: ${periodo} ═══
Investido: R$ ${totalSpend.toFixed(2)} | Impressões: ${mktFmt(totalImpr)} | Cliques: ${mktFmt(totalClicks)} | Leads: ${totalLeads}
CPM médio: R$ ${avgCPM} | CPC médio: R$ ${avgCPC} | CTR médio: ${avgCTR}%
Score saúde das campanhas: ${avgHealth !== null ? avgHealth+'/100' : 'N/A'}
Campanhas ativas com dados: ${camps.length}

TOP CAMPANHAS POR INVESTIMENTO:
${topCamps}

DADOS ORGÂNICOS:
Facebook: ${fbFans} seguidores | Views 7d: ${fbViews} | Engajamentos: ${fbEng}
Instagram ${igUser}: ${igFans} seguidores | ${igPosts} posts | ${igLikes} curtidas` : '\n(Sem dados META carregados — oriente o usuário a carregar o Relatório primeiro)';

  return `Você é o Diretor de Marketing IA da plataforma DigitalMind.
Especialista em META Ads, Marketing 5.0 (Kotler), análise de performance e estratégia digital.
Você TEM ACESSO aos dados reais abaixo. Use-os nas análises. Seja direto e específico.
Responda em português brasileiro. Cite números reais. Dê recomendações acionáveis e priorizadas.

${empCtx}
Contexto 6Ps: ${ps.join(' | ')}
${adsCtx}`;
}

function sendQM(txt){ const el=document.getElementById('mkt-msg');if(el){el.value=txt;sendMktMsg();} }

async function sendMktMsg(){
  const input=document.getElementById('mkt-msg');
  const text=input.value.trim();if(!text)return;
  input.value='';
  appendSpecialMsg('user',text,'chat-mkt');
  MKT.chatHistory.push({role:'user',content:text});
  const btn=document.getElementById('send-mkt');if(btn)btn.disabled=true;
  const lid='ml-'+Date.now();
  document.getElementById('chat-mkt')?.insertAdjacentHTML('beforeend',`<div class="msg agent" id="${lid}"><div class="msg-av">🎯</div><div class="msg-bub"><div class="typing"><span></span><span></span><span></span></div></div></div>`);
  document.getElementById('chat-mkt').scrollTop=99999;
  try {
    const msgs=MKT.chatHistory.slice(-20);
    const res=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},body:JSON.stringify({messages:msgs,clientContext:`Empresa: ${S.empresa?.nome}, Setor: ${S.empresa?.setor}`,systemPrompt:mktGetSystemPrompt()})});
    document.getElementById(lid)?.remove();
    const data=await res.json();const reply=data.reply||'';
    MKT.chatHistory.push({role:'assistant',content:reply});
    appendSpecialMsg('agent',reply,'chat-mkt');
  } catch(e){document.getElementById(lid)?.remove();appendSpecialMsg('agent','❌ Erro: '+e.message,'chat-mkt');}
  finally{if(btn)btn.disabled=false;}
}

function sendMktQ(t){document.getElementById('mkt-msg').value=t;sendMktMsg();}

async function mktInjectMetrics(){
  // Agora injeta dados completos do DS + orgânico
  const camps = DS.campanhas.filter(c=>c.spend>0||c.impressions>0);
  const spend = camps.reduce((s,c)=>s+c.spend,0);
  const leads = camps.reduce((s,c)=>s+c.leads,0);
  const igFans = document.getElementById('mk-ig-fans')?.textContent||'—';
  const fbFans = document.getElementById('mk-fans')?.textContent||'—';
  if(camps.length > 0){
    const sumEl = document.getElementById('mkt-context-summary');
    if(sumEl) sumEl.textContent = `${camps.length} camps · R$${spend.toFixed(2)} · ${leads} leads | FB: ${fbFans} | IG: ${igFans}`;
    appendSpecialMsg('agent',
      `✅ **Dados META injetados com sucesso!**\n\n📊 **Ads:** ${camps.length} campanhas · R$ ${spend.toFixed(2)} investidos · ${leads} leads\n📘 **Facebook:** ${fbFans} seguidores\n📷 **Instagram:** ${igFans} seguidores\n\nAgora posso fazer análises completas com dados reais. O que você precisa?`,
      'chat-mkt');
  } else {
    appendSpecialMsg('agent','⚠️ Nenhum dado carregado ainda. Vá em **Relatório → ↻ Carregar** primeiro.','chat-mkt');
  }
}

function initMktChat(){
  const el=document.getElementById('chat-mkt');if(!el||el.innerHTML!=='')return;
  const camps = DS.campanhas.filter(c=>c.spend>0||c.impressions>0);
  const hasDados = camps.length > 0;
  const spend = hasDados ? camps.reduce((s,c)=>s+c.spend,0) : 0;
  const leads = hasDados ? camps.reduce((s,c)=>s+c.leads,0) : 0;
  const igFans = document.getElementById('mk-ig-fans')?.textContent||'—';
  if(hasDados){
    appendSpecialMsg('agent',
      `Olá! Sou seu **Diretor de Marketing IA**.\n\n📊 **Dados carregados:** ${camps.length} campanhas · R$ ${spend.toFixed(2)} investidos · ${leads} leads · IG: ${igFans} seguidores\n\nPosso analisar performance, otimizar campanhas, criar copy e desenvolver estratégias com base nos dados reais. O que você precisa?`,
      'chat-mkt');
  } else {
    appendSpecialMsg('agent',
      `Olá! Sou seu **Diretor de Marketing IA**.\n\nPara análises com dados reais, vá em **Relatório → ↻ Carregar** primeiro.\n\nJá posso ajudar com estratégia, copy e planejamento. O que você precisa?`,
      'chat-mkt');
  }
}

// ── Calendário ──
function mktCalMonth(d){MKT.calDate.setMonth(MKT.calDate.getMonth()+d);mktRenderCalendar();}
function mktRenderCalendar(){
  const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const y=MKT.calDate.getFullYear(),m=MKT.calDate.getMonth();
  const t=document.getElementById('mkt-cal-title');if(t)t.textContent=months[m]+' '+y;
  const firstDay=new Date(y,m,1).getDay();
  const daysInMonth=new Date(y,m+1,0).getDate();
  const daysInPrev=new Date(y,m,0).getDate();
  const today=new Date();
  let html='';
  const totalCells=Math.ceil((firstDay+daysInMonth)/7)*7;
  for(let i=0;i<totalCells;i++){
    let day,isOther=false,isToday=false;
    if(i<firstDay){day=daysInPrev-firstDay+i+1;isOther=true;}
    else if(i>=firstDay+daysInMonth){day=i-firstDay-daysInMonth+1;isOther=true;}
    else{day=i-firstDay+1;isToday=today.getDate()===day&&today.getMonth()===m&&today.getFullYear()===y;}
    const dateStr=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const evts=isOther?[]:MKT.events.filter(e=>e.date===dateStr);
    html+=`<div style="min-height:75px;padding:6px 4px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);${isOther?'opacity:.3':''}${isToday?';background:rgba(124,109,250,.06)':''};cursor:pointer" onclick="mktAddPostDate('${dateStr}')">
      <div style="font-size:11px;font-weight:700;color:${isToday?'var(--accent)':'var(--muted)'};margin-bottom:3px">${day}</div>
      ${evts.map(e=>`<div style="font-size:10px;padding:2px 5px;border-radius:3px;margin-bottom:2px;border-left:2px solid ${e.color};background:${e.color}18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600">${e.title}</div>`).join('')}
    </div>`;
  }
  const body=document.getElementById('mkt-cal-body');if(body)body.innerHTML=html;
}

function mktRenderWeek(){
  const now=new Date();
  const ws=new Date(now);ws.setDate(now.getDate()-now.getDay());
  const we=new Date(ws);we.setDate(ws.getDate()+7);
  const wevts=MKT.events.filter(e=>{const d=new Date(e.date+'T12:00:00');return d>=ws&&d<=we;});
  const platIcons={facebook:'🔵',instagram:'🟣',whatsapp:'🟢'};
  const el=document.getElementById('mkt-week-schedule');if(!el)return;
  el.innerHTML=wevts.length?wevts.map(e=>`
    <div style="padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);border-left:3px solid ${e.color}">
      <div style="font-size:10px;color:var(--muted)">${new Date(e.date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'})}</div>
      <div style="font-size:12px;font-weight:700;margin-top:2px">${e.title}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${platIcons[e.plat]||'📌'} ${e.plat}</div>
    </div>`).join('')
    :'<div style="color:var(--muted);font-size:12px">Nenhum post esta semana.</div>';
}

function mktAddPost(){mktAddPostDate(new Date().toISOString().slice(0,10));}
function mktAddPostDate(date){
  const title=prompt('Título do post:', '');if(!title)return;
  const plat=prompt('Plataforma (facebook/instagram/whatsapp):', 'instagram')||'instagram';
  const colors={facebook:'#1877F2',instagram:'#e1306c',whatsapp:'#25d366'};
  MKT.events.push({date,title,plat,color:colors[plat]||'#7c6dfa'});
  mktRenderCalendar();mktRenderWeek();
  // Save to Supabase if logged in
  if(S.user){sb.from('agendamentos').insert({user_id:S.user.id,titulo:title,tipo_conteudo:'post',data_producao:date,descricao:plat,status:'agendado'}).catch(()=>{});}
}

function mktShowSQL(){
  const sql=`-- DigitalMind Hub — Marketing 5.0
-- Tabelas Supabase — Execute no SQL Editor

-- 1. Snapshots de insights (coleta diária)
CREATE TABLE IF NOT EXISTS mkt_page_insights (
  id            BIGSERIAL PRIMARY KEY,
  page_id       TEXT NOT NULL DEFAULT '${MKT.config.pageId}',
  date          DATE NOT NULL,
  period        TEXT DEFAULT 'week',
  fans          INTEGER DEFAULT 0,
  followers     INTEGER DEFAULT 0,
  page_views    INTEGER DEFAULT 0,
  engagements   INTEGER DEFAULT 0,
  total_actions INTEGER DEFAULT 0,
  video_views   INTEGER DEFAULT 0,
  raw_json      JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, date, period)
);

-- 2. Cache de posts com métricas
CREATE TABLE IF NOT EXISTS mkt_posts (
  id           BIGSERIAL PRIMARY KEY,
  post_id      TEXT UNIQUE NOT NULL,
  page_id      TEXT NOT NULL,
  message      TEXT,
  type         TEXT,
  permalink    TEXT,
  published_at TIMESTAMPTZ,
  reach        INTEGER DEFAULT 0,
  engagements  INTEGER DEFAULT 0,
  clicks       INTEGER DEFAULT 0,
  raw_json     JSONB,
  synced_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Campanhas de ads
CREATE TABLE IF NOT EXISTS mkt_campaigns (
  id            BIGSERIAL PRIMARY KEY,
  campaign_id   TEXT UNIQUE NOT NULL,
  ad_account_id TEXT,
  name          TEXT,
  status        TEXT,
  objective     TEXT,
  spend_30d     NUMERIC(10,2) DEFAULT 0,
  reach_30d     INTEGER DEFAULT 0,
  clicks_30d    INTEGER DEFAULT 0,
  results_30d   INTEGER DEFAULT 0,
  cpa           NUMERIC(10,2),
  raw_json      JSONB,
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Adicionar campo token na tabela empresas (se não existir)
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS meta_page_token TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS meta_page_id TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS meta_ad_account TEXT;

-- Índices
CREATE INDEX IF NOT EXISTS idx_mkt_insights_date ON mkt_page_insights(date DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_posts_pub ON mkt_posts(published_at DESC);

-- 5. CRONOGRAMA DE GRAVAÇÕES
CREATE TABLE IF NOT EXISTS cronograma (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id   BIGINT REFERENCES empresas(id) ON DELETE SET NULL,
  titulo       TEXT NOT NULL,
  data_inicio  DATE NOT NULL,
  hora_inicio  TIME,
  hora_fim     TIME,
  tipo         TEXT DEFAULT 'gravacao',
  plataforma   TEXT DEFAULT 'todas',
  urgencia     TEXT DEFAULT 'media',
  prazo        DATE,
  descricao    TEXT,
  gcal_event_id TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Cronograma
ALTER TABLE cronograma ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "cronograma_user" ON cronograma
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cronograma_data ON cronograma(data_inicio, hora_inicio);
CREATE INDEX IF NOT EXISTS idx_cronograma_user ON cronograma(user_id);

-- ══ CRM LEADS ══
CREATE TABLE IF NOT EXISTS crm_leads (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, empresa TEXT, whatsapp TEXT, email TEXT,
  fonte TEXT DEFAULT 'outro',
  estagio TEXT DEFAULT 'novo',
  valor NUMERIC(12,2), responsavel TEXT, proximo_contato DATE,
  observacoes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "crm_user" ON crm_leads FOR ALL USING (auth.uid()=user_id);

-- ══ ESTOQUE ══
CREATE TABLE IF NOT EXISTS estoque (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, sku TEXT, categoria TEXT DEFAULT 'produto',
  qtd_atual INTEGER DEFAULT 0, qtd_minima INTEGER DEFAULT 0,
  custo_unit NUMERIC(10,2) DEFAULT 0, preco_venda NUMERIC(10,2) DEFAULT 0,
  fornecedor TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "estoque_user" ON estoque FOR ALL USING (auth.uid()=user_id);

-- ══ METAS FINANCEIRAS ══
CREATE TABLE IF NOT EXISTS metas_financeiras (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mes TEXT NOT NULL,
  meta_receita NUMERIC(12,2), limite_despesas NUMERIC(12,2), meta_lucro NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, mes)
);
ALTER TABLE metas_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "metas_user" ON metas_financeiras FOR ALL USING (auth.uid()=user_id);`;

  document.getElementById('mkt-sql-content').textContent=sql;
  document.getElementById('mkt-sql-block').style.display='block';
}

// Init mkt on nav — load insights auto if token exists
function initMktPage(){
  if(!MKT.config.adAccount) MKT.config.adAccount = 'act_374471102656220';
  mktTab('estrategia', document.getElementById('mktab-estrategia'));
  // Carrega dados Meta em background para ter quando abrir Campanhas
  if(MKT.config.token) { setTimeout(dashCarregarTudo, 500); }
}

function dashCarregarMktCampanhas(){
  if(MKT.config.token) {
    dashCarregarTudo();
  } else {
    const w=document.getElementById('mkt-token-warn');
    if(w) w.style.display='flex';
    mktSetStatus(false,'Sem token');
  }
}

// ══════════════════════════════════════════════
// CHECKLISTS E AGENDA
// ══════════════════════════════════════════════
const CL={
  adm:[{g:'🧠 Pensar',items:['Missão e visão definidas','Metas OKRs','Análise SWOT','Planejamento anual']},{g:'🗂️ Organizar',items:['Organograma','Processos mapeados','Manual de funções','Ferramentas de gestão']},{g:'🤝 Delegar',items:['Papéis definidos','Reuniões de acompanhamento','Cultura de feedback','Plano de desenvolvimento']},{g:'📈 Gestão',items:['KPIs monitorados','Dashboard','Ciclo PDCA','Relatório mensal']}],
  mkt:[{g:'🎯 Era de marketing',items:['Foco no produto (1.0)','Segmentação (2.0)','Propósito de marca (3.0)','Integração digital-físico (4.0)','Uso de IA e dados (5.0)']},{g:'📣 Posicionamento',items:['Proposta de valor','Persona mapeada','Jornada do cliente','Análise de concorrentes']},{g:'📊 Canais',items:['Redes sociais','Estratégia de conteúdo','Funil de vendas','Métricas CAC/LTV']},{g:'🤖 Marketing 5.0',items:['Automação','Personalização por dados','IA para segmentação','Marketing preditivo']}]
};

function renderChecklists(){
  ['adm','mkt'].forEach(p=>{
    const c=document.getElementById(p+'-grid');if(!c)return;
    c.innerHTML=CL[p].map(g=>`<div class="adm-card"><div class="adm-card-header"><div class="adm-icon">${g.g.split(' ')[0]}</div><div class="adm-card-title">${g.g.substring(3)}</div></div>${g.items.map(i=>`<div class="checklist-item"><div class="check-box" onclick="toggleCk(this,'${p}')"></div>${i}</div>`).join('')}</div>`).join('');
  });
}

function toggleCk(el,p){const done=el.classList.toggle('done');el.textContent=done?'✓':'';const color=p==='mkt'?'var(--mkt)':'var(--adm)';el.style.background=done?color:'';el.style.borderColor=done?color:'';}

async function renderAgenda(){
  const {data}=await sb.from('agendamentos').select('*').eq('user_id',S.user.id).order('data_producao',{ascending:true});
  const g=document.getElementById('agenda-grid');if(!g)return;
  if(!data?.length){g.innerHTML='<p style="color:var(--muted);font-size:14px;grid-column:1/-1">Nenhum agendamento.</p>';return;}
  g.innerHTML=data.map(a=>`<div class="agenda-card"><div style="font-family:'Outfit',sans-serif;font-size:13px;font-weight:700;color:var(--mkt);margin-bottom:4px">${fmtD(a.data_producao)} ${a.horario||''}</div><div style="font-size:14px;font-weight:500;margin-bottom:4px">${a.titulo}</div><div style="font-size:12px;color:var(--muted)">${a.tipo_conteudo||''}</div><span class="status-badge status-${a.status}">${a.status}</span></div>`).join('');
}

async function salvarAgenda(){
  const titulo=document.getElementById('ag-titulo').value.trim();const data=document.getElementById('ag-data').value;
  if(!titulo||!data){alert('Preencha título e data.');return;}
  await sb.from('agendamentos').insert({user_id:S.user.id,titulo,tipo_conteudo:document.getElementById('ag-tipo').value,data_producao:data,descricao:document.getElementById('ag-desc').value,status:'agendado'});
  closeModal('modal-agenda');renderAgenda();
}

// ══════════════════════════════════════════════
// PAINEL ADMIN
// ══════════════════════════════════════════════
const AD={autenticado:false,clienteSelecionado:null,clientes:[]};

async function sha256(text){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function handleAdminLogin(){
  const user=document.getElementById('admin-user-input').value.trim();
  const pass=document.getElementById('admin-pass-input').value;
  if(!user||!pass){showAdminMsg('Preencha usuário e senha.','error');return;}
  const userH=await sha256(user);const passH=await sha256(pass);
  if(userH===ADMIN_USER_HASH&&passH===ADMIN_PASS_HASH){
    AD.autenticado=true;
    document.getElementById('admin-login-screen').style.display='none';
    document.getElementById('admin-screen').style.display='flex';
    await carregarTodosClientes();
    adminNav('clientes',document.getElementById('anav-clientes'));
  } else {showAdminMsg('Credenciais incorretas.','error');}
}

function showAdminMsg(text,type){const el=document.getElementById('admin-login-msg');el.textContent=text;el.className='auth-msg '+type;el.style.display='block';}

function adminLogout(){
  AD.autenticado=false;AD.clienteSelecionado=null;AD.clientes=[];
  document.getElementById('admin-screen').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
}

function adminNav(panel,btn){
  document.querySelectorAll('.apanel').forEach(p=>p.style.display='none');
  document.querySelectorAll('[id^=anav-]').forEach(b=>b.classList.remove('active'));
  const el=document.getElementById('apanel-'+panel);if(el)el.style.display='block';
  if(btn)btn.classList.add('active');
  if(panel==='clientes')renderAdminClientes();
  if(panel==='financeiro')renderAdminFinanceiro();
  if(panel==='ficha'&&AD.clienteSelecionado)carregarFichaCliente();
  if(panel==='sixps'&&AD.clienteSelecionado)carregarSixpsCliente();
  if(panel==='matriz'&&AD.clienteSelecionado)carregarMatrizCliente();
  if(panel==='notas'&&AD.clienteSelecionado)carregarNotasCliente();
}

// FIX 5: carregarTodosClientes com service key correta
async function carregarTodosClientes() {
  const sk = SB_SERVICE && SB_SERVICE.length > 50 ? SB_SERVICE : SB_ANON;
  const headers = {
    'apikey': sk,
    'Authorization': `Bearer ${sk}`,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/empresas?select=*&order=created_at.desc`, { headers });
    const data = await r.json();
    AD.clientes = Array.isArray(data) ? data : [];
    console.log('Clientes carregados:', AD.clientes.length, sk === SB_SERVICE ? '(service key)' : '(anon key)');
  } catch(e) {
    console.error('Erro ao carregar clientes:', e);
    AD.clientes = [];
  }
}

function renderAdminClientes(){
  const grid=document.getElementById('admin-clientes-grid');if(!grid)return;
  if(!AD.clientes.length){grid.innerHTML='<div style="color:var(--muted);font-size:14px;grid-column:1/-1">Nenhum cliente encontrado. Verifique a service key do Supabase.</div>';return;}
  grid.innerHTML=AD.clientes.map(c=>`<div class="admin-client-card ${AD.clienteSelecionado?.id===c.id?'selected':''}" onclick="selecionarCliente('${c.id}')"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:14px">${c.nome||'—'}</div><div style="width:8px;height:8px;border-radius:50%;background:var(--success)"></div></div><div style="font-size:12px;color:var(--muted);margin-bottom:10px">${c.setor||'—'} · ${c.responsavel||'—'}</div><div style="display:flex;gap:4px;flex-wrap:wrap"><span style="font-size:10px;background:rgba(124,109,250,.15);color:var(--accent);padding:2px 6px;border-radius:4px">ADM ${c.score_adm||0}%</span><span style="font-size:10px;background:rgba(78,205,196,.15);color:var(--mkt);padding:2px 6px;border-radius:4px">MKT ${c.score_mkt||0}%</span><span style="font-size:10px;background:rgba(247,183,49,.15);color:var(--fin);padding:2px 6px;border-radius:4px">FIN ${c.score_fin||0}%</span></div></div>`).join('');
}

async function selecionarCliente(id){
  AD.clienteSelecionado=AD.clientes.find(c=>c.id===id);
  document.getElementById('admin-cliente-ativo').textContent=`Cliente: ${AD.clienteSelecionado?.nome}`;
  renderAdminClientes();
  adminNav('ficha',document.getElementById('anav-ficha'));
}

async function carregarFichaCliente(){
  const c=AD.clienteSelecionado;if(!c)return;
  document.getElementById('admin-ficha-titulo').textContent=`Ficha — ${c.nome}`;
  document.getElementById('af-nome').value=c.nome||'';
  document.getElementById('af-setor').value=c.setor||'';
  document.getElementById('af-resp').value=c.responsavel||'';
  document.getElementById('af-desc').value=c.descricao||'';
  const sk=SB_SERVICE&&SB_SERVICE.length>50?SB_SERVICE:SB_ANON;
  const headers={'apikey':sk,'Authorization':`Bearer ${sk}`};
  try {
    const r=await fetch(`${SB_URL}/rest/v1/lancamentos?user_id=eq.${c.user_id}&select=tipo,valor`,{headers});
    const lancs=await r.json();
    if(Array.isArray(lancs)){
      const ent=lancs.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+parseFloat(l.valor||0),0);
      const sai=lancs.filter(l=>l.tipo==='saida').reduce((s,l)=>s+parseFloat(l.valor||0),0);
      document.getElementById('admin-ficha-fin').innerHTML=`<div style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Receitas</span><span style="color:var(--success);font-weight:600">${fmt(ent)}</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Despesas</span><span style="color:var(--danger);font-weight:600">${fmt(sai)}</span></div><div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:8px"><span style="font-weight:600">Saldo</span><span style="font-weight:700;color:${ent-sai>=0?'var(--success)':'var(--danger)'}">${fmt(ent-sai)}</span></div></div>`;
    }
  } catch(e){}
}

// FIX 6+7: adminSalvarFicha com service key + atualiza memória
async function adminSalvarFicha(){
  const c=AD.clienteSelecionado;if(!c)return;
  const sk=SB_SERVICE&&SB_SERVICE.length>50?SB_SERVICE:SB_ANON;
  const headers={'apikey':sk,'Authorization':`Bearer ${sk}`,'Content-Type':'application/json','Prefer':'return=representation'};
  const body=JSON.stringify({nome:document.getElementById('af-nome').value,setor:document.getElementById('af-setor').value,responsavel:document.getElementById('af-resp').value,descricao:document.getElementById('af-desc').value});
  await fetch(`${SB_URL}/rest/v1/empresas?id=eq.${c.id}`,{method:'PATCH',headers,body});
  await carregarTodosClientes();
  // Atualiza cliente selecionado em memória
  if(AD.clienteSelecionado){
    AD.clienteSelecionado=AD.clientes.find(x=>x.id===AD.clienteSelecionado.id)||AD.clienteSelecionado;
    document.getElementById('admin-cliente-ativo').textContent='Cliente: '+AD.clienteSelecionado.nome;
  }
  alert('Ficha atualizada com sucesso!');
}

async function carregarSixpsCliente(){
  const c=AD.clienteSelecionado;if(!c)return;
  const sk=SB_SERVICE&&SB_SERVICE.length>50?SB_SERVICE:SB_ANON;
  const headers={'apikey':sk,'Authorization':`Bearer ${sk}`};
  const r=await fetch(`${SB_URL}/rest/v1/sixps_progresso?user_id=eq.${c.user_id}`,{headers});
  const data=await r.json();const prog=Array.isArray(data)?data[0]:null;
  const ps=['p1','p2','p3','p4','p5','p6'];
  const labels={p1:'Propósito',p2:'Pessoas',p3:'Produto/Serviço',p4:'Processo',p5:'Posicionamento',p6:'Performance'};
  const icons={p1:'🧭',p2:'👥',p3:'📦',p4:'⚙️',p5:'🎯',p6:'📈'};
  const el=document.getElementById('admin-sixps-content');if(!el)return;
  if(!prog){el.innerHTML='<div style="color:var(--muted);font-size:14px;grid-column:1/-1">Cliente ainda não iniciou os 6Ps.</div>';return;}
  el.innerHTML=ps.map(p=>{
    const status=prog[p+'_status']||'bloqueado';
    return`<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><div style="font-family:'Outfit',sans-serif;font-weight:700">${icons[p]} ${labels[p]}</div><span class="p-badge ${status}">${status==='concluido'?'✓ Concluído':status==='em_andamento'?'Em andamento':'🔒 Bloqueado'}</span></div><div style="display:flex;gap:6px;margin-top:8px"><button class="btn btn-ghost btn-sm" onclick="adminVerConversas('${p}','${c.user_id}')">Ver conversa</button>${status==='em_andamento'?`<button class="btn btn-success btn-sm" onclick="adminAprovarP('${p}','${c.user_id}')">✓ Aprovar</button>`:''}</div></div>`;
  }).join('');
}

async function adminAprovarP(modulo,userId){
  const sk=SB_SERVICE&&SB_SERVICE.length>50?SB_SERVICE:SB_ANON;
  const headers={'apikey':sk,'Authorization':`Bearer ${sk}`,'Content-Type':'application/json'};
  const ps=['p1','p2','p3','p4','p5','p6'];const idx=ps.indexOf(modulo);
  const updates={[modulo+'_status']:'concluido'};
  if(idx<ps.length-1)updates[ps[idx+1]+'_status']='em_andamento';
  await fetch(`${SB_URL}/rest/v1/sixps_progresso?user_id=eq.${userId}`,{method:'PATCH',headers,body:JSON.stringify(updates)});
  await carregarSixpsCliente();alert(`${modulo.toUpperCase()} aprovado!`);
}

async function adminVerConversas(modulo,userId){
  const sk=SB_SERVICE&&SB_SERVICE.length>50?SB_SERVICE:SB_ANON;
  const headers={'apikey':sk,'Authorization':`Bearer ${sk}`};
  const r=await fetch(`${SB_URL}/rest/v1/sixps_conversas?user_id=eq.${userId}&modulo=eq.${modulo}&order=created_at`,{headers});
  const convs=await r.json();
  if(!Array.isArray(convs)||!convs.length){alert('Sem conversas ainda.');return;}
  const txt=convs.map(c=>`[${c.role.toUpperCase()}]: ${c.content}`).join('\n\n---\n\n');
  const w=window.open('','_blank');w.document.write(`<pre style="font-family:sans-serif;padding:20px;white-space:pre-wrap">${txt}</pre>`);
}

async function carregarMatrizCliente(){
  const c=AD.clienteSelecionado;if(!c)return;
  const sk=SB_SERVICE&&SB_SERVICE.length>50?SB_SERVICE:SB_ANON;
  const headers={'apikey':sk,'Authorization':`Bearer ${sk}`};
  const r=await fetch(`${SB_URL}/rest/v1/matriz_agente?user_id=eq.${c.user_id}`,{headers});
  const data=await r.json();const m=Array.isArray(data)?data[0]:null;
  if(m){document.getElementById('am-tom').value=m.tom||'direto';document.getElementById('am-foco').value=m.foco_pilar||'todos';document.getElementById('am-contexto').value=m.contexto_base||'';document.getElementById('am-objetivos').value=m.objetivos_principais||'';document.getElementById('am-restricoes').value=m.restricoes||'';}
}

async function adminSalvarMatriz(){
  const c=AD.clienteSelecionado;if(!c)return;
  const sk=SB_SERVICE&&SB_SERVICE.length>50?SB_SERVICE:SB_ANON;
  const headers={'apikey':sk,'Authorization':`Bearer ${sk}`,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=representation'};
  await fetch(`${SB_URL}/rest/v1/matriz_agente`,{method:'POST',headers,body:JSON.stringify({user_id:c.user_id,tom:document.getElementById('am-tom').value,foco_pilar:document.getElementById('am-foco').value,contexto_base:document.getElementById('am-contexto').value,objetivos_principais:document.getElementById('am-objetivos').value,restricoes:document.getElementById('am-restricoes').value,updated_at:new Date().toISOString()})});
  alert('Matriz do agente salva!');
}

async function carregarNotasCliente(){
  const c=AD.clienteSelecionado;if(!c)return;
  const sk=SB_SERVICE&&SB_SERVICE.length>50?SB_SERVICE:SB_ANON;
  const headers={'apikey':sk,'Authorization':`Bearer ${sk}`};
  const r=await fetch(`${SB_URL}/rest/v1/admin_notas?user_id=eq.${c.user_id}&order=created_at.desc`,{headers});
  const notas=await r.json();const el=document.getElementById('admin-notas-list');if(!el)return;
  if(!Array.isArray(notas)||!notas.length){el.innerHTML='<div style="color:var(--muted);font-size:14px">Nenhuma nota ainda.</div>';return;}
  const tipoIcon={geral:'📝',alerta:'⚠️',oportunidade:'💡',reuniao:'📅'};
  el.innerHTML=notas.map(n=>`<div class="card" style="margin-bottom:10px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><div style="font-weight:600;font-size:13px">${tipoIcon[n.tipo]||'📝'} ${n.titulo}</div><div style="font-size:11px;color:var(--muted)">${new Date(n.created_at).toLocaleDateString('pt-BR')}</div></div><div style="font-size:13px;color:var(--muted)">${n.conteudo||''}</div></div>`).join('');
}

function adminAdicionarNota(){document.getElementById('admin-nota-form').style.display='block';document.getElementById('an-titulo').value='';document.getElementById('an-conteudo').value='';}

async function adminSalvarNota(){
  const c=AD.clienteSelecionado;if(!c)return;
  const sk=SB_SERVICE&&SB_SERVICE.length>50?SB_SERVICE:SB_ANON;
  const headers={'apikey':sk,'Authorization':`Bearer ${sk}`,'Content-Type':'application/json'};
  await fetch(`${SB_URL}/rest/v1/admin_notas`,{method:'POST',headers,body:JSON.stringify({user_id:c.user_id,titulo:document.getElementById('an-titulo').value,conteudo:document.getElementById('an-conteudo').value,tipo:document.getElementById('an-tipo').value})});
  document.getElementById('admin-nota-form').style.display='none';
  await carregarNotasCliente();
}

async function renderAdminFinanceiro(){
  const grid=document.getElementById('admin-fin-grid');if(!grid)return;
  grid.innerHTML='<div style="color:var(--muted);font-size:14px;grid-column:1/-1">Carregando...</div>';
  const sk=SB_SERVICE&&SB_SERVICE.length>50?SB_SERVICE:SB_ANON;
  const headers={'apikey':sk,'Authorization':`Bearer ${sk}`};
  const cards=await Promise.all(AD.clientes.map(async c=>{
    try{const r=await fetch(`${SB_URL}/rest/v1/lancamentos?user_id=eq.${c.user_id}&select=tipo,valor`,{headers});const lancs=await r.json();const ent=Array.isArray(lancs)?lancs.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+parseFloat(l.valor||0),0):0;const sai=Array.isArray(lancs)?lancs.filter(l=>l.tipo==='saida').reduce((s,l)=>s+parseFloat(l.valor||0),0):0;return{nome:c.nome,ent,sai,saldo:ent-sai};}catch(e){return{nome:c.nome,ent:0,sai:0,saldo:0};}
  }));
  grid.innerHTML=cards.map(c=>`<div class="metric-card"><div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;margin-bottom:10px">${c.nome}</div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:11px;color:var(--muted)">Receitas</span><span style="font-size:13px;color:var(--success);font-weight:500">${fmt(c.ent)}</span></div><div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:11px;color:var(--muted)">Despesas</span><span style="font-size:13px;color:var(--danger);font-weight:500">${fmt(c.sai)}</span></div><div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:8px"><span style="font-size:11px;font-weight:600">Saldo</span><span style="font-size:14px;font-weight:700;color:${c.saldo>=0?'var(--success)':'var(--danger)'}">${fmt(c.saldo)}</span></div></div>`).join('');
}

function adminAdicionarCliente(){alert('Para adicionar um cliente, crie uma conta para ele em digitalmind-roan.vercel.app e ele aparecerá aqui automaticamente.');}

// ══════════════════════════════════════════════
// MÓDULO 6Ps
// ══════════════════════════════════════════════
const SIXPS_CONFIG={
  p1:{
    titulo:'P1 — Propósito',
    sub:'O DNA estratégico do seu negócio',
    icon:'🧭',
    cor:'#2563eb',
    agentName:'Consultor de Propósito',
    outputsLabel:'DNA · Missão · Visão · Valores',
    syncDesc:'Alimenta o contexto de TODOS os agentes e módulos',
    conclusaoSinal:'✅ P1 concluído',
    systemPrompt:`Você é o Consultor de Propósito do DigitalMind. Seu papel é extrair o DNA estratégico real da empresa. Seja direto, desafiador e consultor — não aceite respostas vagas. Quando a resposta for genérica, aprofunde com "Por quê?" ou "Como especificamente?". Use as respostas para construir outputs concretos e acionáveis.

CONTEXTO DA EMPRESA: {CONTEXTO}

SEQUÊNCIA OBRIGATÓRIA — siga exatamente:

ABERTURA (primeira mensagem):
Apresente-se brevemente e faça a Pergunta 1 diretamente.

BLOCO 1 — MISSÃO (problema real que resolve):
Pergunta 1: "Qual problema específico seus clientes têm ANTES de te contratar? Seja concreto — não 'ajudar empresas', mas qual dor exata você resolve?"
[Se resposta vaga → desafie: "Isso ainda é genérico. Pense: o que acontece na empresa do seu cliente quando ele NÃO tem você? O que ele perde?"]
Pergunta 1b: "Complete: 'Eu existo para que [cliente específico] pare de [problema] e consiga [resultado concreto].'"

BLOCO 2 — VISÃO (onde quer chegar com números):
Pergunta 2: "Daqui a 12 meses, quais são os 3 números que vão provar que você teve sucesso? (ex: X clientes, R$Y faturamento, Z% do mercado)"
[Se resposta sem números → desafie: "Visão sem número é sonho. Me dê pelo menos 2 métricas concretas."]
Pergunta 2b: "Qual é o reconhecimento externo que você quer ter nesse prazo? (prêmio, posição de mercado, referência regional/nacional)"

BLOCO 3 — VALORES (como realmente opera):
Pergunta 3: "Me dê um exemplo real de decisão difícil que sua empresa tomou (ou tomaria) baseada nos seus valores. Isso revela mais do que escolher palavras bonitas."
[Use o exemplo para extrair 3-4 valores reais com base no comportamento descrito]
Pergunta 3b: "Existe algo que você NUNCA faria mesmo que pagassem bem? Isso define seus limites de valor."

BLOCO 4 — DECLARAÇÃO E METAS EXTRAÍDAS:
Com base em tudo respondido, apresente:

##DECLARAÇÃO_PROPÓSITO (3 linhas objetivas para o dashboard)
##MISSÃO (1 frase com: quem atende + problema que resolve + resultado que gera)
##VISÃO (1 frase com prazo + número + posicionamento)
##VALORES (lista de 3-5 com 1 linha de comportamento esperado cada)
##METAS_P6 (extraia números concretos mencionados — faturamento, clientes, prazo)
##DNA_RESUMO (parágrafo de 3 linhas para o agente central usar como contexto)

Finalize OBRIGATORIAMENTE com: "✅ P1 concluído! Seu DNA estratégico está definido. O P2 — Produto/Serviço está desbloqueado!"

REGRAS: Faça UMA pergunta por vez. Nunca aceite resposta vaga sem aprofundar. Use os números e exemplos reais que o cliente deu. Responda em português brasileiro.`
  },
  p2:{
    titulo:'P2 — Produto / Serviço',
    sub:'O que você vende, o que vale e o que sustenta o negócio',
    icon:'📦',
    cor:'#2563eb',
    agentName:'Consultor de Produto',
    outputsLabel:'Catálogo · Precificação · Margem',
    syncDesc:'Cria produtos no Estoque e referência de receita no Financeiro',
    conclusaoSinal:'✅ P2 concluído',
    systemPrompt:`Você é o Consultor de Produto do DigitalMind. Mapeie com precisão tudo que a empresa vende, quanto custa produzir e quanto vale para o cliente. Seja consultor — questione precificação, margem e posicionamento de produto.

CONTEXTO DA EMPRESA: {CONTEXTO}
PROPÓSITO DEFINIDO: {P1}

SEQUÊNCIA OBRIGATÓRIA:

BLOCO 1 — PORTFÓLIO:
Pergunta 1: "Liste TODOS os produtos/serviços que você oferece hoje, mesmo os que não divulga ativamente. Nada de omitir."
[Para cada item extraia: Nome | Descrição em 1 linha | Preço de venda | Custo de entrega/produção | Frequência (único/recorrente/sazonal)]

BLOCO 2 — ANÁLISE DE RECEITA:
Pergunta 2: "Qual desses gera mais receita hoje? E qual você passa mais tempo entregando mas ganha menos? Essa diferença revela onde está o problema."
[Se houver desalinhamento → aponte: "Você passa X% do tempo no produto Y que representa Z% da receita. Isso faz sentido?"]

BLOCO 3 — PRECIFICAÇÃO (desafiadora):
Pergunta 3: "Como você chegou no preço atual? É baseado em custo, concorrência ou valor percebido pelo cliente?"
[Se baseado só em custo ou concorrência → desafie: "Seu cliente paga pelo resultado, não pelo seu custo. Qual resultado mensurável você entrega? Quanto vale isso para ele?"]
Pergunta 3b: "Se você pudesse cobrar 30% a mais em algum produto/serviço sem perder clientes, qual seria e por quê?"

BLOCO 4 — LANÇAMENTOS E GAPS:
Pergunta 4: "O que seus clientes mais pedem que você ainda não oferece formalmente?"
Pergunta 5: "Existe algo que você faz mas não cobra? Isso é produto não precificado."

CONCLUSÃO — apresente:
##CATÁLOGO_COMPLETO (tabela: produto|preço_venda|custo|margem%|tipo)
##PRODUTO_ESTRELA (maior receita e por quê)
##PRODUTO_PROBLEMA (alto tempo, baixa margem)
##OPORTUNIDADES (o que não está sendo cobrado ou pode ser lançado)
##RECEITA_POTENCIAL (soma do portfólio × volume estimado)
##DADOS_ESTOQUE (formato para criação automática no módulo de estoque)

Finalize OBRIGATORIAMENTE com: "✅ P2 concluído! Portfólio mapeado e sincronizado com o Estoque. O P3 — Pessoas está desbloqueado!"
Responda em português brasileiro.`
  },
  p3:{
    titulo:'P3 — Pessoas',
    sub:'Time, funções, custos e gaps operacionais',
    icon:'👥',
    cor:'#2563eb',
    agentName:'Consultor de Pessoas',
    outputsLabel:'Organograma · Custos · Gaps',
    syncDesc:'Registra custo fixo de pessoal no Financeiro automaticamente',
    conclusaoSinal:'✅ P3 concluído',
    systemPrompt:`Você é o Consultor de Pessoas do DigitalMind. Mapeie a estrutura real de pessoas — não o organograma bonito, mas como as coisas realmente funcionam. Questione sobrecarga, gaps e delegação.

CONTEXTO DA EMPRESA: {CONTEXTO}
PROPÓSITO: {P1}
PRODUTOS: {P2}

SEQUÊNCIA OBRIGATÓRIA:

BLOCO 1 — MAPEAMENTO REAL:
Pergunta 1: "Liste cada pessoa que trabalha na empresa (incluindo você), a função real que exerce e o custo mensal total (salário + encargos ou valor PJ)."
[Formato esperado: Nome/Cargo | Função real | Custo mensal R$]
[Se solopreneur → "Você está sozinho. Isso significa que você acumula as funções de: comercial, operacional, financeiro e marketing. Confirma? Qual consome mais do seu tempo?"]

BLOCO 2 — FLEXIBILIDADE DE FUNÇÃO (CRÍTICO para o sistema):
Pergunta 2: "Para cada pessoa listada, me diz: a função dela é FIXA (só faz aquilo, não tem perfil ou disponibilidade para outras atividades) ou FLEXÍVEL (pode apoiar outras áreas quando necessário)?"
[Para cada pessoa → registre: Nome | Função fixa | Pode apoiar em: X, Y, Z OU Função exclusiva]
[Exemplo: "Pedro — Operacional FIXO — não tem perfil comercial e não está disponível para prospecção"]
[Isso é essencial porque o sistema usará essas informações para NÃO sugerir tarefas inadequadas para cada pessoa nos planos de ação futuros]

BLOCO 3 — DIAGNÓSTICO DE SOBRECARGA:
Pergunta 3: "Onde está o gargalo hoje? Qual função está acumulada em uma pessoa que não deveria estar?"
Pergunta 4: "O que você faz pessoalmente que uma contratação de R$2.000/mês poderia resolver? Isso é custo de oportunidade."
[Se identificar sobrecarga no fundador → aponte: "Você está operando como funcionário do seu próprio negócio. Isso limita o crescimento."]

BLOCO 4 — GAPS CRÍTICOS:
Pergunta 5: "Quais dessas áreas não têm um responsável claro hoje?"
Opções: Comercial/Vendas | Marketing/Conteúdo | Financeiro/Contas | Atendimento/CS | Operacional/Entrega | Tecnologia
[Para cada gap identificado → "Quanto você estima que está custando esse gap em receita perdida por mês?"]

BLOCO 5 — PRÓXIMOS PASSOS:
Pergunta 6: "Se você pudesse fazer UMA contratação agora, qual função resolveria o maior problema? Por quê essa e não outra?"

CONCLUSÃO — apresente:
##ORGANOGRAMA_ATUAL (lista: pessoa|função|custo_mensal|tipo:fixo_ou_flexivel|pode_apoiar_em)
##CUSTO_TOTAL_PESSOAL (soma de todos os custos)
##GAPS_CRÍTICOS (funções sem responsável + impacto estimado)
##SOBRECARGA (onde está concentrada e o que delegar)
##PRÓXIMA_CONTRATAÇÃO (recomendação com justificativa)
##CUSTO_FIXO_PESSOAL (valor para o módulo Financeiro)
##RESTRIÇÕES_EQUIPE (lista explícita de quem NÃO pode ser alocado em quais funções — para uso em todos os planos de ação do sistema)

Finalize OBRIGATORIAMENTE com: "✅ P3 concluído! Estrutura de pessoas mapeada e custos sincronizados com o Financeiro. O P4 — Processo está desbloqueado!"
Responda em português brasileiro.`
  },
  p4:{
    titulo:'P4 — Processo',
    sub:'Como a operação funciona do primeiro contato ao resultado',
    icon:'⚙️',
    cor:'#2563eb',
    agentName:'Consultor de Processos',
    outputsLabel:'Mapa Operacional · Funil · Gargalos',
    syncDesc:'Alimenta as etapas do funil no CRM de Marketing',
    conclusaoSinal:'✅ P4 concluído',
    systemPrompt:`Você é o Consultor de Processos do DigitalMind. Mapeie como a operação realmente funciona — do primeiro contato ao resultado entregue. Identifique gargalos, retrabalho e onde a experiência do cliente se deteriora.

CONTEXTO DA EMPRESA: {CONTEXTO}
PRODUTOS: {P2}
PESSOAS: {P3}

SEQUÊNCIA OBRIGATÓRIA — mapeie cada etapa do funil:

BLOCO 1 — AQUISIÇÃO (como o cliente chega):
Pergunta 1: "Descreva o caminho exato que um novo cliente percorre até chegar até você. Desde o primeiro contato até o momento em que paga."
[Se resposta superficial → "Seja mais específico: é por indicação de quem? Pelo Instagram por qual tipo de post? Quanto tempo leva esse caminho em média?"]
Pergunta 1b: "De 10 leads que entram, quantos viram clientes? Esse número é o seu problema ou sua vantagem?"

BLOCO 2 — ENTREGA (como executa):
Pergunta 2: "Descreva passo a passo o que acontece depois que o cliente paga. Desde o onboarding até a entrega final."
[Identifique: quem faz o quê + qual ferramenta + qual o prazo de cada etapa]
Pergunta 2b: "Onde costuma ter atraso, retrabalho ou reclamação? Seja honesto — esse é o gargalo real."

BLOCO 3 — PÓS-VENDA (como retém e cresce):
Pergunta 3: "O que acontece 30 dias depois da entrega? Você tem algum processo de acompanhamento ou o cliente some?"
Pergunta 3b: "Como um cliente satisfeito vira indicação? Isso é processo ou acidente?"

BLOCO 4 — FERRAMENTAS E TECNOLOGIA:
Pergunta 4: "Liste todas as ferramentas que usa hoje (WhatsApp, Planilhas, CRM, etc). Quais são insubstituíveis e quais são gambiarras?"

CONCLUSÃO — apresente:
##FUNIL_COMPLETO (etapas: Aquisição→Qualificação→Proposta→Fechamento→Onboarding→Entrega→Pós-venda)
##TAXA_CONVERSÃO_ATUAL (número real de leads → clientes)
##GARGALOS_CRÍTICOS (onde perde tempo, dinheiro ou cliente)
##FERRAMENTAS_ATUAIS (lista com avaliação: essencial/gambiarra/substituir)
##OPORTUNIDADES_PROCESSO (o que automatizar ou estruturar)
##ETAPAS_CRM (formato para configuração do funil no CRM)

Finalize OBRIGATORIAMENTE com: "✅ P4 concluído! Mapa operacional criado e funil sincronizado com o CRM. O P5 — Posicionamento está desbloqueado!"
Responda em português brasileiro.`
  },
  p5:{
    titulo:'P5 — Posicionamento',
    sub:'Para quem você existe e por que te escolhem',
    icon:'🎯',
    cor:'#2563eb',
    agentName:'Consultor de Posicionamento',
    outputsLabel:'Persona · ICP · Proposta de Valor',
    syncDesc:'Cria Persona no CRM e alimenta o Agente de Marketing',
    conclusaoSinal:'✅ P5 concluído',
    systemPrompt:`Você é o Consultor de Posicionamento do DigitalMind. Construa o posicionamento real de mercado — quem é o cliente ideal, qual dor exata ele tem, e por que sua empresa e não outra. Use os dados dos Ps anteriores para conectar propósito, produto e processo com o cliente certo.

CONTEXTO DA EMPRESA: {CONTEXTO}
PROPÓSITO: {P1}
PRODUTOS: {P2}
PROCESSO/FUNIL: {P4}

SEQUÊNCIA OBRIGATÓRIA:

BLOCO 1 — CLIENTE IDEAL REAL (não o que você quer, mas quem de fato compra):
Pergunta 1: "Descreva seu melhor cliente atual — não o ideal imaginário, mas o real que paga bem, não dá trabalho e indica outros. Quem é essa pessoa/empresa?"
[Extraia: perfil demográfico + comportamental + situação antes de contratar]
Pergunta 1b: "Qual é o momento exato da vida/negócio desse cliente em que ele te procura? O que aconteceu que fez ele buscar uma solução?"

BLOCO 2 — DOR REAL E RESULTADO REAL:
Pergunta 2: "Qual é a frase que seu cliente ideal usaria para descrever o problema dele — nas palavras DELE, não nas suas?"
[Se resposta técnica → "Seu cliente não fala assim. Ele diz 'Estou perdido com as redes sociais' não 'preciso de estratégia de marketing digital'. Qual é a frase real?"]
Pergunta 2b: "Qual transformação concreta aconteceu nos seus melhores cases? Antes: X. Depois: Y. Me dê números reais se tiver."

BLOCO 3 — CONCORRÊNCIA E DIFERENCIAL:
Pergunta 3: "Quando um cliente pesquisa alternativas a você, o que ele encontra? Cite os concorrentes reais — diretos e indiretos (incluindo 'fazer internamente' ou 'não fazer nada')."
Pergunta 3b: "Por que um cliente que comparou você com um concorrente te escolheu? O que ele disse? Isso é seu diferencial real."

BLOCO 4 — CANAIS E MENSAGEM:
Pergunta 4: "Onde seu cliente ideal passa tempo online e offline? Seja específico: qual grupo do Facebook, qual evento, qual tipo de conteúdo consome."
Pergunta 4b: "Se você tivesse 30 segundos para convencer seu cliente ideal, qual seria a frase? Teste aqui comigo."
[Avalie a frase e sugira melhorias se necessário]

CONCLUSÃO — apresente:
##PERSONA_PRIMÁRIA (nome fictício + perfil completo: demográfico, comportamental, dores, desejos, objeções)
##ICP_B2B (se aplicável: porte, setor, cargo decisor, momento de compra)
##DOR_CENTRAL (frase nas palavras do cliente)
##TRANSFORMAÇÃO (antes → depois com números)
##DIFERENCIAL_REAL (por que escolhem você e não o concorrente)
##CANAIS_PRIORITÁRIOS (onde comunicar + tipo de conteúdo)
##PROPOSTA_DE_VALOR_ÚNICA (1 frase poderosa)
##CONFIGURAÇÃO_CRM (campos para setup do CRM: origem, perfil, objeções comuns)

Finalize OBRIGATORIAMENTE com: "✅ P5 concluído! Persona e posicionamento definidos e sincronizados com o CRM e Agente de Marketing. O P6 — Performance está desbloqueado!"
Responda em português brasileiro.`
  },
  p6:{
    titulo:'P6 — Performance',
    sub:'Metas, KPIs e o sistema de monitoramento do crescimento',
    icon:'📈',
    cor:'#2563eb',
    agentName:'Consultor de Performance',
    outputsLabel:'OKRs · KPIs · Metas Financeiras',
    syncDesc:'Configura Metas Financeiras e KPIs do dashboard automaticamente',
    conclusaoSinal:'✅ P6 concluído',
    systemPrompt:`Você é o Consultor de Performance do DigitalMind. Transforme tudo que foi definido nos Ps anteriores em metas mensuráveis, KPIs monitoráveis e um OKR trimestral concreto. Sem meta vaga — tudo com número, prazo e responsável.

CONTEXTO DA EMPRESA: {CONTEXTO}
PROPÓSITO E VISÃO: {P1}
PRODUTOS E RECEITA: {P2}
PESSOAS E CUSTOS: {P3}
PROCESSO E FUNIL: {P4}
CLIENTE IDEAL: {P5}

ABERTURA: Use os dados dos Ps anteriores para contextualizar. Ex: "Com base no que você mapeou — [resumo do propósito] com [produto principal] vendido para [persona] — vamos transformar isso em números."

SEQUÊNCIA OBRIGATÓRIA:

BLOCO 1 — DIAGNÓSTICO ATUAL (números reais):
Pergunta 1: "Qual é o faturamento médio dos últimos 3 meses? Seja honesto — esse é o ponto de partida, não de julgamento."
Pergunta 1b: "Quantos clientes ativos você tem hoje? E qual a taxa de churn (quantos saem por mês)?"
Pergunta 1c: "Qual seu custo fixo mensal total? (inclua pessoal, ferramentas, estrutura)"
[Com esses 3 números calcule e apresente: margem atual, ponto de equilíbrio, receita por cliente]

BLOCO 2 — METAS (baseadas na visão do P1):
[Use os números da visão definida no P1 como referência]
Pergunta 2: "Para atingir [visão do P1] em [prazo do P1], o que precisa acontecer nos próximos 90 dias? Vamos trabalhar de trás para frente."
[Calcule e apresente: meta de receita mensal → quantos clientes necessários → quantas propostas → quantos leads → qual canal]
Pergunta 2b: "Essa meta é desafiadora mas atingível? Ou precisa ajustar o prazo/ambição?"

BLOCO 3 — KPIs (o que monitorar semanalmente):
Pergunta 3: "Dos números abaixo, quais você consegue medir hoje? E quais nunca mediu?"
[Apresente lista contextualizada com base nos produtos e processo mapeados]
Pergunta 3b: "Se você tivesse que olhar 1 número toda segunda-feira para saber se a semana foi boa, qual seria?"

BLOCO 4 — OKR 90 DIAS:
[Monte o OKR usando todas as informações coletadas]
"Com base em tudo que mapeamos, aqui está seu OKR para os próximos 90 dias:"
[Apresente: Objetivo inspirador + 3 Key Results mensuráveis + ações semanais]
"Isso está alinhado com o que você quer construir?"

CONCLUSÃO — apresente:
##SITUAÇÃO_ATUAL (faturamento|clientes|custo_fixo|margem)
##META_RECEITA_MENSAL (valor em R$ com prazo)
##META_CLIENTES (número com prazo)
##TICKET_MÉDIO_ALVO (R$ por cliente)
##PONTO_EQUILIBRIO (R$ mínimo para cobrir custos)
##KPIs_SEMANAIS (lista de 5-7 métricas com fórmula)
##OKR_90_DIAS (objetivo + 3 key results + responsável)
##CONFIGURACAO_METAS_FIN (valores para módulo financeiro: meta_receita, limite_despesas, meta_lucro)

Finalize OBRIGATORIAMENTE com: "✅ P6 concluído! 🎉 Os 6Ps da DigitalMind estão completos. Seu DNA empresarial está estruturado e todos os módulos foram alimentados automaticamente!"
Responda em português brasileiro.`
  }
};


const SP={progresso:null,moduloAtivo:null,conversas:{},dados:{}};

async function loadSixps(){
  try {
    // Usa limit(1) para evitar falha com múltiplas linhas (single() lança erro se houver duplicatas)
    const{data:rows}=await sb.from('sixps_progresso').select('*').eq('user_id',S.user.id).limit(1);
    const data = rows && rows.length > 0 ? rows[0] : null;
    if(!data){
      const{data:novo}=await sb.from('sixps_progresso').insert({
        user_id:S.user.id,
        p1_status:'em_andamento',p2_status:'bloqueado',p3_status:'bloqueado',
        p4_status:'bloqueado',p5_status:'bloqueado',p6_status:'bloqueado'
      }).select().limit(1);
      SP.progresso=(novo&&novo[0])||{p1_status:'em_andamento',p2_status:'bloqueado',p3_status:'bloqueado',p4_status:'bloqueado',p5_status:'bloqueado',p6_status:'bloqueado'};
    } else {
      SP.progresso=data;
    }
  } catch(e) {
    console.error('loadSixps error:', e);
    // Tenta buscar novamente sem single() em caso de erro
    try {
      const{data:fallback}=await sb.from('sixps_progresso').select('*').eq('user_id',S.user.id).limit(1);
      if(fallback&&fallback.length)SP.progresso=fallback[0];
      else SP.progresso={p1_status:'em_andamento',p2_status:'bloqueado',p3_status:'bloqueado',p4_status:'bloqueado',p5_status:'bloqueado',p6_status:'bloqueado'};
    } catch(e2){
      SP.progresso={p1_status:'em_andamento',p2_status:'bloqueado',p3_status:'bloqueado',p4_status:'bloqueado',p5_status:'bloqueado',p6_status:'bloqueado'};
    }
  }
  // Carrega resumos brutos para fallback
  try {
    const {data:dados} = await sb.from('sixps_dados').select('modulo,resumo').eq('user_id',S.user.id);
    if(dados) dados.forEach(d=>{ SP.dados[d.modulo+'_resumo']=d.resumo; });
  } catch(e) {}
  // Carrega MATRIZ CENTRAL — fonte única de verdade
  await matrizCarregar();
  renderSixpsGrid();
}

function renderSixpsGrid(){
  const grid=document.getElementById('sixps-grid');if(!grid)return;
  if(!SP.progresso) {
    SP.progresso={p1_status:'em_andamento',p2_status:'bloqueado',p3_status:'bloqueado',p4_status:'bloqueado',p5_status:'bloqueado',p6_status:'bloqueado'};
  }
  const ps=['p1','p2','p3','p4','p5','p6'];
  grid.innerHTML=ps.map(p=>{
    const cfg=SIXPS_CONFIG[p];
    const status=SP.progresso[p+'_status']||'bloqueado';
    const bloqueado=status==='bloqueado';
    const concluido=status==='concluido';
    const statusLabel=concluido?'✓ Concluído':status==='em_andamento'?'Em andamento':'🔒 Bloqueado';
    const statusBg=concluido?'rgba(16,185,129,.15)':status==='em_andamento'?'rgba(37,99,235,.15)':'rgba(128,128,160,.08)';
    const statusColor=concluido?'var(--success)':status==='em_andamento'?'var(--accent)':'var(--muted)';
    return `<div class="card" style="cursor:${bloqueado?'not-allowed':'pointer'};opacity:${bloqueado?'.4':'1'};transition:all .25s;padding:20px;text-align:center"
      ${!bloqueado?`onclick="abrirP('${p}')" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,.08)'" onmouseout="this.style.transform='';this.style.boxShadow=''"`:''}> 
      <div style="width:36px;height:36px;border-radius:9px;background:${concluido?'#1b1b21':'#f4f4f5'};display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:${concluido?'#fff':'#8f8f9c'};font-size:12px;font-weight:700;font-family:'Outfit',sans-serif">${p.toUpperCase()}</div>
      <div style="font-family:'Outfit',sans-serif;font-weight:600;font-size:13px;margin-bottom:4px;color:#1b1b21">${cfg.titulo.replace(/P\d — /,'')}</div>
      <div style="font-size:10px;color:${concluido?'#1b1b21':'#8f8f9c'};font-weight:500">${statusLabel}</div>
    </div>`;
  }).join('');

  // Mostra fluxograma quando pelo menos P1-P5 concluídos
  const p15Concluidos = ['p1','p2','p3','p4','p5'].every(p=>SP.progresso[p+'_status']==='concluido');
  const todosConcluidos = ps.every(p=>SP.progresso[p+'_status']==='concluido');
  const fluxEl = document.getElementById('sixps-fluxograma');
  if(fluxEl) {
    fluxEl.style.display = p15Concluidos ? 'block' : 'none';
    if(p15Concluidos) atualizarFluxograma();
  }
}

async function abrirP(modulo){
  SP.moduloAtivo=modulo;const cfg=SIXPS_CONFIG[modulo];
  document.getElementById('sixps-home').style.display='none';document.getElementById('sixps-modulo').style.display='block';
  document.getElementById('sixps-modulo-titulo').textContent=cfg.titulo;document.getElementById('sixps-modulo-sub').textContent=cfg.sub;
  document.getElementById('sixps-agent-name').textContent=cfg.agentName;document.getElementById('sixps-dados-titulo').textContent='Dados — '+cfg.titulo;
  document.getElementById('sixps-diagrama').style.display=modulo==='p4'?'block':'none';
  await loadConversasSixps(modulo);
}

function mostrarBotaoConcluir(modulo) {
  // Mostra botão manual após algumas mensagens trocadas
  const conversas = SP.conversas[modulo]||[];
  if(conversas.length >= 2) {
    const btn = document.getElementById('btn-concluir-manual');
    if(btn) btn.style.display = 'inline-block';
  }
}

function concluirPManual() {
  const modulo = SP.moduloAtivo;
  const btn = document.getElementById('btn-concluir-manual');
  if(btn) btn.style.display = 'none';
  const statusEl = document.getElementById('sixps-status-label');
  if(statusEl) { statusEl.textContent='✅ Concluindo...'; statusEl.style.color='var(--success)'; statusEl.style.borderColor='var(--success)'; }
  concluirP(modulo);
}

function voltarSixps(){SP.moduloAtivo=null;document.getElementById('sixps-home').style.display='block';document.getElementById('sixps-modulo').style.display='none';}

// ── POPUP DETALHE DO PILAR ──
const POPUP_P_CONFIG = {
  p1:{ icon:'🧭', cor:'#2563eb', jornada:[
    {label:'DIAGNÓSTICO', desc:'Por que a empresa existe? Qual transformação entrega?'},
    {label:'MISSÃO', desc:'O propósito real em 1 frase direta'},
    {label:'VISÃO', desc:'Onde quer chegar + prazo + número'},
    {label:'VALORES', desc:'Os princípios inegociáveis do negócio'},
    {label:'DNA ESTRATÉGICO', desc:'Síntese que orienta TODOS os agentes'},
    {label:'OUTPUT', desc:'Alimenta todos os módulos do sistema'}
  ]},
  p2:{ icon:'📦', cor:'#8b5cf6', jornada:[
    {label:'INVENTÁRIO', desc:'Todos os produtos e serviços atuais'},
    {label:'PRECIFICAÇÃO', desc:'Lógica de preço e margem de cada item'},
    {label:'MODELO DE RECEITA', desc:'Como o dinheiro entra — recorrente, único, % crescimento'},
    {label:'PORTFÓLIO FUTURO', desc:'Transição agência → SaaS'},
    {label:'SINCRONIA', desc:'Produtos enviados ao Estoque e Financeiro'}
  ]},
  p3:{ icon:'👥', cor:'#0ea5e9', jornada:[
    {label:'MAPEAMENTO', desc:'Cada pessoa, função real e custo'},
    {label:'FLEXIBILIDADE', desc:'Quem é fixo vs quem pode apoiar outras áreas'},
    {label:'SOBRECARGA', desc:'Onde a operação trava por acúmulo de funções'},
    {label:'GAPS CRÍTICOS', desc:'Funções sem responsável e impacto estimado'},
    {label:'RESTRIÇÕES', desc:'Quem NÃO pode ser alocado em quais funções'},
    {label:'SINCRONIA', desc:'Custo fixo de pessoal enviado ao Financeiro'}
  ]},
  p4:{ icon:'⚙️', cor:'#10b981', jornada:[
    {label:'MAPEAMENTO', desc:'Do primeiro contato ao resultado entregue'},
    {label:'FUNIL', desc:'Etapas de aquisição → fechamento → entrega'},
    {label:'GARGALOS', desc:'Onde a operação perde velocidade ou qualidade'},
    {label:'AUTOMAÇÕES', desc:'O que pode ser automatizado para ganhar escala'},
    {label:'SINCRONIA', desc:'Etapas do funil enviadas ao CRM de Marketing'}
  ]},
  p5:{ icon:'🎯', cor:'#f59e0b', jornada:[
    {label:'PERSONA', desc:'Perfil detalhado do cliente ideal real'},
    {label:'DOR CENTRAL', desc:'O problema específico que faz comprar'},
    {label:'PROPOSTA DE VALOR', desc:'Transformação prometida em 1 frase'},
    {label:'DIFERENCIAL', desc:'Por que escolher a empresa e não a concorrência'},
    {label:'CANAIS', desc:'Onde e como o cliente ideal é encontrado'},
    {label:'SINCRONIA', desc:'Persona e posicionamento enviados ao CRM e Marketing'}
  ]},
  p6:{ icon:'📈', cor:'#ef4444', jornada:[
    {label:'DIAGNÓSTICO', desc:'Situação atual em números reais'},
    {label:'METAS 90 DIAS', desc:'Trabalhando de trás para frente da visão do P1'},
    {label:'KPIs SEMANAIS', desc:'Métricas monitoradas toda segunda-feira'},
    {label:'OKR TRIMESTRAL', desc:'Objetivo + 3 Key Results + responsáveis'},
    {label:'CONFIGURAÇÃO', desc:'Metas financeiras enviadas ao módulo Financeiro'}
  ]}
};

let popupPAtivo = null;

function abrirPopupP(modulo) {
  const cfg = POPUP_P_CONFIG[modulo];
  const sixpsCfg = SIXPS_CONFIG[modulo];
  if(!cfg) return;
  popupPAtivo = modulo;

  document.getElementById('popup-p-icon').textContent = cfg.icon;
  document.getElementById('popup-p-titulo').textContent = sixpsCfg.titulo;
  document.getElementById('popup-p-sub').textContent = sixpsCfg.sub;

  // Mini fluxo da jornada
  const fluxoEl = document.getElementById('popup-p-minifluxo');
  fluxoEl.innerHTML = cfg.jornada.map((step, i) => `
    <div style="display:flex;gap:10px;margin-bottom:14px;align-items:flex-start">
      <div style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#a5b4fc;margin-top:1px">${i+1}</div>
      <div>
        <div style="font-size:10px;font-weight:700;color:${cfg.cor};letter-spacing:.8px;margin-bottom:2px">${step.label}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.55);line-height:1.5">${step.desc}</div>
      </div>
    </div>
    ${i < cfg.jornada.length-1 ? '<div style="margin-left:11px;border-left:1px dashed rgba(99,102,241,0.25);height:8px;margin-bottom:6px"></div>' : ''}
  `).join('');

  // Conclusão/dados mapeados
  const conclusaoEl = document.getElementById('popup-p-conclusao');
  const resumo = SP.dados[modulo+'_resumo'];

  if(resumo && resumo.length > 50) {
    const formatado = resumo
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:rgba(255,255,255,0.9)">$1</strong>')
      .replace(/##(.*?)\n/g, '<div style="font-size:10px;font-weight:700;color:'+cfg.cor+';letter-spacing:.8px;margin:12px 0 4px;text-transform:uppercase">$1</div>')
      .replace(/\n/g, '<br>');
    conclusaoEl.innerHTML = formatado;
  } else {
    // Usa dados da matriz se disponível
    const mzData = buildMatrizResumoP(modulo);
    conclusaoEl.innerHTML = mzData || '<span style="color:rgba(255,255,255,0.3);font-style:italic">Este pilar ainda não foi respondido. Clique em "Editar / Continuar" para começar.</span>';
  }

  const overlay = document.getElementById('popup-p-overlay');
  overlay.style.display = 'flex';
}

function buildMatrizResumoP(modulo) {
  if(!MZ) return '';
  const campos = {
    p1: [['Missão', MZ.p1_missao], ['Visão', MZ.p1_visao], ['Valores', MZ.p1_valores], ['DNA', MZ.p1_dna]],
    p2: [['Modelo', MZ.p2_modelo_negocio], ['Receita mensal', MZ.p2_receita_mensal ? 'R$ '+MZ.p2_receita_mensal.toLocaleString('pt-BR') : null], ['Ticket médio', MZ.p2_ticket_medio ? 'R$ '+MZ.p2_ticket_medio : null], ['Precificação', MZ.p2_precificacao], ['Portfólio', MZ.p2_portfolio]],
    p3: [['Funcionários', MZ.p3_num_funcionarios], ['Custo pessoal', MZ.p3_custo_pessoal ? 'R$ '+MZ.p3_custo_pessoal.toLocaleString('pt-BR') : null], ['Custo fixo total', MZ.p3_custo_fixo_total ? 'R$ '+MZ.p3_custo_fixo_total.toLocaleString('pt-BR') : null], ['Estrutura', MZ.p3_estrutura], ['Restrições', MZ.p3_restricoes_equipe]],
    p4: [['Funil', MZ.p4_funil], ['Ciclo de venda', MZ.p4_ciclo_venda], ['Gargalos', MZ.p4_gargalos], ['Processo', MZ.p4_processo]],
    p5: [['Persona', MZ.p5_persona_nome], ['Perfil', MZ.p5_persona_perfil], ['Dor central', MZ.p5_dor_central], ['Proposta de valor', MZ.p5_proposta_valor], ['Diferencial', MZ.p5_diferencial], ['Canais', MZ.p5_canais]],
    p6: [['Meta receita', MZ.p6_meta_receita ? 'R$ '+MZ.p6_meta_receita.toLocaleString('pt-BR')+'/mês' : null], ['Meta clientes', MZ.p6_meta_clientes], ['Ticket alvo', MZ.p6_ticket_alvo ? 'R$ '+MZ.p6_ticket_alvo.toLocaleString('pt-BR') : null], ['Ponto de equilíbrio', MZ.p6_ponto_equilibrio ? 'R$ '+MZ.p6_ponto_equilibrio.toLocaleString('pt-BR') : null], ['OKR', MZ.p6_okr], ['KPIs', MZ.p6_kpis]]
  };
  const lista = (campos[modulo]||[]).filter(([k,v]) => v);
  if(!lista.length) return '';
  return lista.map(([k,v]) => `<div style="margin-bottom:10px"><span style="font-size:9px;font-weight:700;color:rgba(99,102,241,0.7);letter-spacing:1px;text-transform:uppercase">${k}</span><br><span style="font-size:12px;color:rgba(255,255,255,0.75)">${v}</span></div>`).join('');
}

function fecharPopupP() {
  document.getElementById('popup-p-overlay').style.display = 'none';
  popupPAtivo = null;
}

function abrirPDoPopup() {
  if(popupPAtivo) {
    fecharPopupP();
    setTimeout(() => abrirP(popupPAtivo), 100);
  }
}

function atualizarFluxograma() {
  setTimeout(initNeuralCanvas, 100);
  // Injeta resumos reais dos Ps no fluxograma (legado)
  const extrair = (resumo, maxLen) => {
    if(!resumo) return '—';
    // Pega primeira linha com conteúdo real (ignora headers ##)
    const linhas = resumo.split('\n').filter(l=>l.trim() && !l.startsWith('#') && !l.startsWith('*') && l.length > 10);
    return linhas[0]?.replace(/\*\*/g,'').trim().slice(0,maxLen) || resumo.slice(0,maxLen);
  };
  const set = (id, txt) => { const el=document.getElementById(id); if(el) el.textContent=txt; };
  set('fl-p1-val', extrair(SP.dados.p1_resumo, 30));
  set('fl-p2-val', extrair(SP.dados.p2_resumo, 30));
  set('fl-p3-val', extrair(SP.dados.p3_resumo, 30));
  set('fl-p4-val', extrair(SP.dados.p4_resumo, 30));
  set('fl-p5-val', extrair(SP.dados.p5_resumo, 35));
}

async function loadConversasSixps(modulo){
  const{data}=await sb.from('sixps_conversas').select('*').eq('user_id',S.user.id).eq('modulo',modulo).order('created_at',{ascending:true}).limit(50);
  SP.conversas[modulo]=data||[];renderConversasSixps(modulo);
  if(!SP.conversas[modulo].length){
    await iniciarAgenteSixps(modulo);
  } else {
    // Verifica se a última mensagem do assistente já contém o sinal de conclusão
    const sinal = SIXPS_CONFIG[modulo]?.conclusaoSinal||'';
    const ultimaAssistente = [...SP.conversas[modulo]].reverse().find(c=>c.role==='assistant');
    if(sinal && ultimaAssistente && ultimaAssistente.content.includes(sinal)) {
      // Já concluído — marca automaticamente sem precisar de interação
      const status = SP.progresso?.[modulo+'_status'];
      if(status !== 'concluido') {
        setTimeout(()=>concluirP(modulo), 500);
      }
    } else {
      mostrarBotaoConcluir(modulo);
    }
  }
}

function renderConversasSixps(modulo){
  const el=document.getElementById('chat-sixps');if(!el)return;
  el.innerHTML='';(SP.conversas[modulo]||[]).forEach(m=>appendSixpsMsg(m.role,m.content));el.scrollTop=el.scrollHeight;
}

function buildSixpsContext(modulo) {
  const emp = S.empresa;
  const base = `Empresa: ${emp?.nome||'não informado'} | Setor: ${emp?.setor||'não informado'} | Fase: ${emp?.fase||'não informado'} | Posicionamento: ${emp?.posicionamento||'não definido'}`;

  // Usa dados estruturados da MATRIZ CENTRAL (campos extraídos por IA)
  // Fallback para resumo bruto se matriz ainda não foi populada
  const p1 = MZ.p1_concluido
    ? `Missão: ${MZ.p1_missao||'—'}\nVisão: ${MZ.p1_visao||'—'}\nValores: ${MZ.p1_valores||'—'}\nDNA: ${MZ.p1_dna||'—'}`
    : (SP.dados.p1_resumo ? SP.dados.p1_resumo.slice(0,1500) : 'Ainda não mapeado');

  const p2 = MZ.p2_concluido
    ? `Modelo: ${MZ.p2_modelo_negocio||'—'}\nReceita atual: R$${MZ.p2_receita_mensal||0}/mês\nTicket médio: R$${MZ.p2_ticket_medio||0}\nClientes: ${MZ.p2_num_clientes||0}\nPrecificação: ${MZ.p2_precificacao||'—'}\nProduto principal: ${MZ.p2_produto_principal||'—'}\nPortfólio: ${MZ.p2_portfolio?.slice(0,500)||'—'}`
    : (SP.dados.p2_resumo ? SP.dados.p2_resumo.slice(0,1500) : 'Ainda não mapeado');

  const p3 = MZ.p3_concluido
    ? `Funcionários: ${MZ.p3_num_funcionarios||0}\nCusto pessoal: R$${MZ.p3_custo_pessoal||0}/mês\nCusto fixo total: R$${MZ.p3_custo_fixo_total||0}/mês\nEstrutura: ${MZ.p3_estrutura||'—'}\n⚠️ RESTRIÇÕES DE FUNÇÃO (não sugerir tarefas fora disso): ${MZ.p3_restricoes_equipe||'não mapeado'}`
    : (SP.dados.p3_resumo ? SP.dados.p3_resumo.slice(0,1200) : 'Ainda não mapeado');

  const p4 = MZ.p4_concluido
    ? `Funil: ${MZ.p4_funil||'—'}\nCiclo de venda: ${MZ.p4_ciclo_venda||'—'}\nGargalos: ${MZ.p4_gargalos||'—'}\nProcesso: ${MZ.p4_processo?.slice(0,400)||'—'}`
    : (SP.dados.p4_resumo ? SP.dados.p4_resumo.slice(0,1200) : 'Ainda não mapeado');

  const p5 = MZ.p5_concluido
    ? `Persona: ${MZ.p5_persona_nome||'—'} — ${MZ.p5_persona_perfil||'—'}\nDor central: ${MZ.p5_dor_central||'—'}\nProposta de valor: ${MZ.p5_proposta_valor||'—'}\nDiferencial: ${MZ.p5_diferencial||'—'}\nCanais: ${MZ.p5_canais||'—'}`
    : (SP.dados.p5_resumo ? SP.dados.p5_resumo.slice(0,1200) : 'Ainda não mapeado');

  return SIXPS_CONFIG[modulo].systemPrompt
    .replace('{CONTEXTO}', base)
    .replace('{P1}', p1)
    .replace('{P2}', p2)
    .replace('{P3}', p3)
    .replace('{P4}', p4)
    .replace('{P5}', p5);
}

async function buildFinanceiroCtx() {
  await matrizAtualizarFinanceiro();
  const ctx = matrizParaContexto();
  return `\n\nMATRIZ CENTRAL DA EMPRESA (fonte única de verdade — dados cruzados de todos os módulos):\n${ctx}\n\nINSTRUÇÃO CRÍTICA: Priorize os dados declarados no P2 (modelo de negócio, receita, precificação) para análise estratégica. Os dados financeiros do sistema (fin_*) são médias dos lançamentos registrados — use como referência complementar, não como base principal.`;
}

async function iniciarAgenteSixps(modulo){
  const cfg=SIXPS_CONFIG[modulo];
  const btn=document.getElementById('send-sixps');if(btn)btn.disabled=true;
  const lid='ls-'+Date.now();
  document.getElementById('chat-sixps')?.insertAdjacentHTML('beforeend',`<div class="msg agent" id="${lid}"><div class="msg-av">✈</div><div class="msg-bub"><div class="typing"><span></span><span></span><span></span></div></div></div>`);
  document.getElementById('chat-sixps').scrollTop=99999;
  try {
    let systemPrompt = buildSixpsContext(modulo);

    // P5 e P6 chegam com análise pronta, não com perguntas
    let msgInicial = 'Inicie a primeira pergunta da jornada.';
    if(modulo==='p5') {
      msgInicial = 'Com base em TODOS os dados dos Ps anteriores já fornecidos no contexto, construa AGORA o cliente ideal completo, a proposta de valor e o posicionamento de mercado. Não faça perguntas iniciais — chegue com a análise pronta e estruturada para que o usuário valide ou ajuste.';
    }
    if(modulo==='p6') {
      const finCtx = await buildFinanceiroCtx();
      systemPrompt += finCtx;
      msgInicial = 'Com base em TODOS os dados dos Ps anteriores e nos dados financeiros reais fornecidos no contexto, construa AGORA o diagnóstico completo com: situação atual em números, metas para os próximos 90 dias, KPIs semanais e OKR trimestral. Não faça perguntas genéricas — chegue com a análise pronta e estruturada usando os dados reais, pedindo validação apenas nos pontos que precisam de confirmação do usuário.';
    }

    const res=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},
      body:JSON.stringify({messages:[{role:'user',content:msgInicial}],clientContext:'',systemPrompt})});
    document.getElementById(lid)?.remove();
    const data=await res.json();
    const reply=data.reply||'Vamos começar!';
    try{await sb.from('sixps_conversas').insert({user_id:S.user.id,modulo,role:'assistant',content:reply});}catch(e2){}
    SP.conversas[modulo]=SP.conversas[modulo]||[];
    SP.conversas[modulo].push({role:'assistant',content:reply});
    appendSixpsMsg('agent',reply);
    try{await sb.from('sixps_progresso').update({[modulo+'_status']:'em_andamento'}).eq('user_id',S.user.id);}catch(e2){}
    // Detecta sinal de conclusão também na abertura (ex: P6 já chega com análise completa)
    const sinalInicial = SIXPS_CONFIG[modulo]?.conclusaoSinal||'';
    if(sinalInicial && reply.includes(sinalInicial)) {
      const statusEl = document.getElementById('sixps-status-label');
      if(statusEl) { statusEl.textContent='✅ Concluindo...'; statusEl.style.color='var(--success)'; statusEl.style.borderColor='var(--success)'; }
      setTimeout(()=>concluirP(SP.moduloAtivo), 2000);
    } else {
      // Mostra botão manual de conclusão
      mostrarBotaoConcluir(modulo);
    }
  } catch(e){document.getElementById(lid)?.remove();appendSixpsMsg('agent','❌ Erro: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}

async function sendSixpsMsg(){
  const input=document.getElementById('sixps-msg');
  const text=input.value.trim();
  if(!text||!SP.moduloAtivo)return;
  input.value='';
  const modulo=SP.moduloAtivo;
  const cfg=SIXPS_CONFIG[modulo];

  appendSixpsMsg('user',text);
  SP.conversas[modulo]=SP.conversas[modulo]||[];
  SP.conversas[modulo].push({role:'user',content:text});
  try{await sb.from('sixps_conversas').insert({user_id:S.user.id,modulo,role:'user',content:text});}catch(e2){}

  const btn=document.getElementById('send-sixps');if(btn)btn.disabled=true;
  const lid='ls-'+Date.now();
  document.getElementById('chat-sixps')?.insertAdjacentHTML('beforeend',`<div class="msg agent" id="${lid}"><div class="msg-av">✈</div><div class="msg-bub"><div class="typing"><span></span><span></span><span></span></div></div></div>`);
  document.getElementById('chat-sixps').scrollTop=99999;
  try {
    const systemPrompt = buildSixpsContext(modulo);
    const msgs=SP.conversas[modulo].slice(-20).map(c=>({role:c.role==='assistant'?'assistant':'user',content:c.content}));
    const res=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},
      body:JSON.stringify({messages:msgs,clientContext:'',systemPrompt})});
    document.getElementById(lid)?.remove();
    const data=await res.json();
    const reply=data.reply||'';
    if(!reply){appendSixpsMsg('agent','❌ Sem resposta. Tente novamente.');return;}
    try{await sb.from('sixps_conversas').insert({user_id:S.user.id,modulo,role:'assistant',content:reply});}catch(e2){}
    SP.conversas[modulo].push({role:'assistant',content:reply});
    appendSixpsMsg('agent',reply);
    if(modulo==='p4')renderDiagramaP4();
    const el=document.getElementById('sixps-dados-content');
    if(el){const resumo=SP.conversas[modulo].filter(c=>c.role==='assistant').slice(-1)[0]?.content||'';if(resumo.length>50)el.innerHTML=resumo.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');}
    // ── Detecção automática de conclusão ──
    const sinal = cfg.conclusaoSinal||'';
    if(sinal && reply.includes(sinal)) {
      const statusEl = document.getElementById('sixps-status-label');
      if(statusEl) { statusEl.textContent='✅ Concluindo...'; statusEl.style.color='var(--success)'; statusEl.style.borderColor='var(--success)'; }
      setTimeout(()=>concluirP(SP.moduloAtivo), 2000);
    } else {
      mostrarBotaoConcluir(modulo);
    }
  } catch(e){document.getElementById(lid)?.remove();appendSixpsMsg('agent','❌ Erro: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}

function appendSixpsMsg(role,text){
  const lbl=role==='agent'?'DM':'👤';
  const fmt2=text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>');
  document.getElementById('chat-sixps')?.insertAdjacentHTML('beforeend',`<div class="msg ${role==='agent'?'agent':'user'}"><div class="msg-av">${lbl}</div><div class="msg-bub">${fmt2}</div></div>`);
  const el=document.getElementById('chat-sixps');if(el)el.scrollTop=el.scrollHeight;
}

async function concluirP(moduloForce){
  const modulo=moduloForce||SP.moduloAtivo;if(!modulo)return;
  const ps=['p1','p2','p3','p4','p5','p6'];const idx=ps.indexOf(modulo);
  const updates={[modulo+'_status']:'concluido'};
  if(idx<ps.length-1)updates[ps[idx+1]+'_status']='em_andamento';
  await sb.from('sixps_progresso').update(updates).eq('user_id',S.user.id).eq('id',SP.progresso.id||0).then(r=>r).catch(()=>sb.from('sixps_progresso').update(updates).eq('user_id',S.user.id));
  SP.progresso={...SP.progresso,...updates};

  // ── INTEGRAÇÃO ENTRE PILARES ──
  await sincronizarPilarComEcossistema(modulo);

  voltarSixps();renderSixpsGrid();
  const prox=idx<ps.length-1?SIXPS_CONFIG[ps[idx+1]].titulo:null;
  appendSpecialMsg('agent',`✅ **${SIXPS_CONFIG[modulo].titulo}** concluído!${prox?`\n\n🔓 **${prox}** foi desbloqueado. Clique para continuar.`:'\n\n🎉 Você completou todos os 6Ps!'}\n\n${getSincronizacaoMsg(modulo)}`,'chat-adm');
}

// ══════════════════════════════════════════════════════════════
// MATRIZ CENTRAL — fonte única de verdade do sistema
// Todos os agentes leem daqui. Todos os módulos escrevem aqui.
// ══════════════════════════════════════════════════════════════

// Cache local da matriz (carregado no init)
let MZ = {};

async function matrizCarregar() {
  try {
    const { data: rows } = await sb.from('matriz_empresa').select('*').eq('user_id', S.user.id).limit(1);
    MZ = (rows && rows.length > 0 ? rows[0] : null) || {};
  } catch(e) { MZ = {}; }
}

async function matrizSalvar(campos) {
  try {
    MZ = { ...MZ, ...campos };
    await sb.from('matriz_empresa').upsert({
      user_id: S.user.id,
      ...campos,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  } catch(e) { console.log('matriz salvar erro:', e.message); }
}

function matrizParaContexto() {
  if(!MZ || !S.empresa) return '';
  const emp = S.empresa;
  const linhas = [
    `EMPRESA: ${emp.nome} | Setor: ${emp.setor||'—'} | Fase: ${emp.fase||'—'}`,
    '',
  ];

  // P1
  if(MZ.p1_concluido) {
    linhas.push(`▸ P1 PROPÓSITO: ${MZ.p1_missao||'—'}`);
    linhas.push(`  Visão: ${MZ.p1_visao||'—'}`);
    linhas.push(`  DNA: ${MZ.p1_dna?.slice(0,200)||'—'}`);
  }

  // P2
  if(MZ.p2_concluido) {
    linhas.push(`▸ P2 PRODUTO: Modelo=${MZ.p2_modelo_negocio||'—'} | Receita atual=R$${MZ.p2_receita_mensal||0}/mês | Ticket médio=R$${MZ.p2_ticket_medio||0} | Clientes=${MZ.p2_num_clientes||0}`);
    linhas.push(`  Precificação: ${MZ.p2_precificacao||'—'}`);
    linhas.push(`  Produto principal: ${MZ.p2_produto_principal||'—'}`);
  }

  // P3
  if(MZ.p3_concluido) {
    linhas.push(`▸ P3 PESSOAS: ${MZ.p3_num_funcionarios||0} pessoas | Custo pessoal=R$${MZ.p3_custo_pessoal||0}/mês | Custo fixo total=R$${MZ.p3_custo_fixo_total||0}/mês`);
    if(MZ.p3_restricoes_equipe) linhas.push(`  ⚠️ RESTRIÇÕES (não sugerir tarefas fora da função): ${MZ.p3_restricoes_equipe}`);
  }

  // P4
  if(MZ.p4_concluido) {
    linhas.push(`▸ P4 PROCESSO: Funil=${MZ.p4_funil||'—'} | Gargalos=${MZ.p4_gargalos||'—'}`);
  }

  // P5
  if(MZ.p5_concluido) {
    linhas.push(`▸ P5 POSICIONAMENTO: Persona=${MZ.p5_persona_nome||'—'} | Dor=${MZ.p5_dor_central||'—'}`);
    linhas.push(`  Proposta de valor: ${MZ.p5_proposta_valor||'—'}`);
    linhas.push(`  Diferencial: ${MZ.p5_diferencial||'—'}`);
  }

  // P6
  if(MZ.p6_concluido) {
    linhas.push(`▸ P6 PERFORMANCE: Meta receita=R$${MZ.p6_meta_receita||0}/mês | Meta clientes=${MZ.p6_meta_clientes||0} | Ponto equilíbrio=R$${MZ.p6_ponto_equilibrio||0}`);
    linhas.push(`  OKR: ${MZ.p6_okr?.slice(0,200)||'—'}`);
  }

  // Financeiro em tempo real
  linhas.push(`▸ FINANCEIRO ATUAL: Receita=R$${MZ.fin_receita_mensal||0} | Despesas=R$${MZ.fin_despesas_mensais||0} | Saldo=R$${MZ.fin_saldo||0} | A pagar=R$${MZ.fin_a_pagar||0} | A receber=R$${MZ.fin_a_receber||0}`);

  // Marketing em tempo real
  if(MZ.mkt_leads_mes || MZ.mkt_investimento) {
    linhas.push(`▸ MARKETING ATUAL: Leads/mês=${MZ.mkt_leads_mes||0} | Invest=R$${MZ.mkt_investimento||0} | CAC=R$${MZ.mkt_cac||0} | Conversão=${MZ.mkt_conversao||0}%`);
  }

  // CRM
  if(MZ.crm_leads_ativos) {
    linhas.push(`▸ CRM: ${MZ.crm_leads_ativos} leads ativos | Pipeline=R$${MZ.crm_receita_pipeline||0}`);
  }

  return linhas.join('\n');
}

// ── Extrai dados estruturados de cada P e salva na matriz ──
async function sincronizarPilarComEcossistema(modulo) {
  const conversas = SP.conversas[modulo] || [];
  const mensagensAssistente = conversas.filter(c=>c.role==='assistant');
  const resumo = mensagensAssistente[mensagensAssistente.length - 1]?.content || '';
  SP.dados[modulo+'_resumo'] = resumo;

  // Salva resumo bruto no sixps_dados (histórico)
  try {
    await sb.from('sixps_dados').upsert({
      user_id: S.user.id, modulo,
      resumo: resumo.slice(0,2000),
      updated_at: new Date().toISOString()
    }, {onConflict:'user_id,modulo'});
  } catch(e) {}

  // Extrai dados estruturados para a matriz central via IA
  await extrairEAtualizarMatriz(modulo, resumo);

  // Sincronizações específicas por pilar
  if(modulo==='p2') await sincP2Estoque(resumo);
  if(modulo==='p3') await sincP3Financeiro(resumo);
  if(modulo==='p5') await sincP5CRM(resumo);
  if(modulo==='p6') await sincP6Metas(resumo);
}

async function extrairEAtualizarMatriz(modulo, resumo) {
  const prompts = {
    p1: `Do texto abaixo, extraia APENAS em JSON (sem texto extra):
{"missao":"string","visao":"string","valores":"string resumido","dna":"string resumo DNA estratégico em 1 parágrafo"}
TEXTO: ${resumo.slice(0,1500)}`,

    p2: `Do texto abaixo, extraia APENAS em JSON (sem texto extra):
{"modelo_negocio":"agencia|saas|hibrido","receita_mensal":numero,"ticket_medio":numero,"num_clientes":numero,"produto_principal":"string","precificacao":"string resumo da lógica de precificação","portfolio":"string resumo portfólio"}
TEXTO: ${resumo.slice(0,1500)}`,

    p3: `Do texto abaixo, extraia APENAS em JSON (sem texto extra):
{"num_funcionarios":numero,"custo_pessoal":numero,"custo_fixo_total":numero,"estrutura":"string resumo estrutura com funções fixas e flexíveis de cada pessoa","restricoes_equipe":"string listando EXPLICITAMENTE quem NÃO pode ser alocado em quais funções — ex: Pedro:fixo operacional sem perfil comercial|Suiene:fixo CS sem perfil prospecção"}
TEXTO: ${resumo.slice(0,1200)}`,

    p4: `Do texto abaixo, extraia APENAS em JSON (sem texto extra):
{"funil":"string etapas","ciclo_venda":"string","gargalos":"string","processo":"string resumo operacional"}
TEXTO: ${resumo.slice(0,1000)}`,

    p5: `Do texto abaixo, extraia APENAS em JSON (sem texto extra):
{"persona_nome":"string","persona_perfil":"string resumo","dor_central":"string","proposta_valor":"string","diferencial":"string","canais":"string","posicionamento":"string resumo completo"}
TEXTO: ${resumo.slice(0,1500)}`,

    p6: `Do texto abaixo, extraia APENAS em JSON (sem texto extra):
{"meta_receita":numero,"meta_clientes":numero,"ticket_alvo":numero,"ponto_equilibrio":numero,"okr":"string resumo OKR","kpis":"string lista KPIs"}
TEXTO: ${resumo.slice(0,1500)}`
  };

  if(!prompts[modulo]) return;

  try {
    const res = await fetch(EDGE, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},
      body: JSON.stringify({
        messages:[{role:'user', content: prompts[modulo]}],
        systemPrompt:'Extraia dados estruturados do texto e retorne APENAS JSON válido, sem texto adicional, sem markdown.'
      })
    });
    const data = await res.json();
    const txt = (data.reply||'{}').replace(/```json|```/g,'').trim();
    const campos = JSON.parse(txt);

    // Monta objeto para salvar na matriz com prefixo do módulo
    const update = { [`${modulo}_concluido`]: true };
    Object.keys(campos).forEach(k => {
      if(campos[k] !== null && campos[k] !== undefined && campos[k] !== '') {
        update[`${modulo}_${k}`] = campos[k];
      }
    });

    await matrizSalvar(update);

    // Atualiza empresa.descricao e empresa.posicionamento para agentes globais
    if(modulo==='p1' && campos.dna) {
      try { await sb.from('empresas').update({descricao: campos.dna.slice(0,600)}).eq('user_id',S.user.id); } catch(e){}
    }
    if(modulo==='p5' && campos.posicionamento) {
      try { await sb.from('empresas').update({posicionamento: campos.posicionamento.slice(0,600)}).eq('user_id',S.user.id); } catch(e){}
    }

  } catch(e) { console.log('extrair matriz erro:', e.message); }
}

// ── Atualiza matriz com dados financeiros em tempo real ──
async function matrizAtualizarFinanceiro() {
  try {
    const mes3 = new Date(new Date().getFullYear(), new Date().getMonth()-2, 1).toISOString().slice(0,10);
    const [rLanc, rPagar, rReceber, rMetas] = await Promise.all([
      sb.from('lancamentos').select('tipo,valor').eq('user_id',S.user.id).gte('data',mes3),
      sb.from('contas_pagar').select('valor').eq('user_id',S.user.id).eq('status','pendente'),
      sb.from('contas_receber').select('valor').eq('user_id',S.user.id).eq('status','pendente'),
      sb.from('metas_financeiras').select('meta_receita').eq('user_id',S.user.id).eq('mes',new Date().toISOString().slice(0,7)).single()
    ]);
    const lanc = rLanc.data||[];
    const ent = lanc.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+parseFloat(l.valor||0),0);
    const sai = lanc.filter(l=>l.tipo==='saida').reduce((s,l)=>s+parseFloat(l.valor||0),0);
    const ap = (rPagar.data||[]).reduce((s,l)=>s+parseFloat(l.valor||0),0);
    const ar = (rReceber.data||[]).reduce((s,l)=>s+parseFloat(l.valor||0),0);
    await matrizSalvar({
      fin_receita_mensal: parseFloat((ent/3).toFixed(2)),
      fin_despesas_mensais: parseFloat((sai/3).toFixed(2)),
      fin_margem: parseFloat(((ent-sai)/3).toFixed(2)),
      fin_saldo: parseFloat((ent-sai).toFixed(2)),
      fin_a_pagar: ap,
      fin_a_receber: ar,
      fin_meta_receita: rMetas.data?.meta_receita||0,
      fin_atualizado_em: new Date().toISOString()
    });
  } catch(e) { console.log('matriz fin erro:', e.message); }
}

// ── Atualiza matriz com dados de marketing em tempo real ──
async function matrizAtualizarMarketing() {
  try {
    const camps = (typeof DS!=='undefined' ? DS.campanhas||[] : []).filter(c=>c.spend>0);
    const totalSpend = camps.reduce((s,c)=>s+c.spend,0);
    const totalLeads = camps.reduce((s,c)=>s+(c.leads||0),0);
    const cac = totalLeads > 0 ? totalSpend/totalLeads : 0;
    const crmLeads = (typeof CRM!=='undefined' ? CRM.leads||[] : []);
    const ativos = crmLeads.filter(l=>!['fechado','perdido'].includes(l.estagio)).length;
    const pipeline = crmLeads.reduce((s,l)=>s+parseFloat(l.valor||0),0);
    await matrizSalvar({
      mkt_leads_mes: totalLeads,
      mkt_investimento: totalSpend,
      mkt_cac: parseFloat(cac.toFixed(2)),
      crm_leads_ativos: ativos,
      crm_receita_pipeline: pipeline,
      mkt_atualizado_em: new Date().toISOString()
    });
  } catch(e) { console.log('matriz mkt erro:', e.message); }
}

function getSincronizacaoMsg(modulo) {
  const msgs = {
    p1: '🧭 **DNA salvo na Matriz Central:** Missão, Visão e Valores agora orientam todos os agentes.',
    p2: '📦 **Matriz atualizada:** Modelo de negócio, receita e precificação sincronizados com Estoque e Financeiro.',
    p3: '👥 **Matriz atualizada:** Estrutura de pessoas e custos sincronizados com o módulo Financeiro.',
    p4: '⚙️ **Matriz atualizada:** Funil e processo operacional sincronizados com o CRM.',
    p5: '🎯 **Matriz atualizada:** Persona e posicionamento sincronizados com Marketing e CRM.',
    p6: '📈 **Matriz atualizada:** Metas, KPIs e OKR configurados no módulo Financeiro.',
  };
  return msgs[modulo] || '';
}

async function sincP2Estoque(resumo) {
  // Extrai produtos do catálogo mapeado no P2
  try {
    const res = await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},
      body:JSON.stringify({
        messages:[{role:'user',content:`Extraia do texto os produtos/serviços mencionados. Retorne SOMENTE JSON array: [{"nome":"...","preco":0,"custo":0,"tipo":"produto|servico"}]. Se não houver dados claros retorne []. TEXTO: ${resumo.slice(0,1500)}`}],
        systemPrompt:'Extraia dados estruturados e retorne apenas JSON válido, sem texto adicional.'
      })});
    const data = await res.json();
    const txt = (data.reply||'[]').replace(/```json|```/g,'').trim();
    const produtos = JSON.parse(txt);
    if(produtos.length && S.user) {
      for(const p of produtos.slice(0,10)) {
        if(!p.nome) continue;
        const {data:existe} = await sb.from('estoque').select('id').eq('user_id',S.user.id).eq('nome',p.nome).single();
        if(!existe) {
          try { await sb.from('estoque').insert({user_id:S.user.id,nome:p.nome,categoria:p.tipo||'servico',preco_venda:p.preco||0,custo_unit:p.custo||0,qtd_atual:0,qtd_minima:0}); } catch(e){}
        }
      }
    }
  } catch(e) { console.log('sinc p2 estoque:', e.message); }
}

async function sincP3Financeiro(resumo) {
  SP.dados.p3_resumo = resumo;
  try {
    const res = await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},
      body:JSON.stringify({
        messages:[{role:'user',content:`Do texto, some todos os salários/custos mensais de pessoal. Retorne SOMENTE um número inteiro (total R$, sem símbolo). Se não encontrar, retorne 0. TEXTO: ${resumo.slice(0,1000)}`}],
        systemPrompt:'Retorne apenas um número inteiro, sem texto.'
      })});
    const data = await res.json();
    const total = parseInt(data.reply||'0')||0;
    if(total > 0) {
      SP.dados.custo_pessoal = total;
      // Pede autorização antes de registrar no Financeiro
      const autorizado = confirm(`📊 Deseja registrar o custo de pessoal (R$ ${total.toLocaleString('pt-BR')}/mês) como lançamento fixo no módulo Financeiro?`);
      if(autorizado) {
        const mes = new Date().toISOString().slice(0,7);
        const {data:existe} = await sb.from('lancamentos').select('id').eq('user_id',S.user.id).eq('categoria','pessoal').gte('data',mes+'-01').single();
        if(!existe) {
          try { await sb.from('lancamentos').insert({user_id:S.user.id,tipo:'saida',descricao:'Custo de pessoal (mapeado no P3)',valor:total,categoria:'pessoal',data:new Date().toISOString().slice(0,10)}); } catch(e){}
        }
      }
    }
  } catch(e) { console.log('sinc p3:', e.message); }
}

async function sincP5CRM(resumo) {
  try {
    SP.dados.persona = resumo;
    if(S.empresa) {
      try {
        await sb.from('empresas').update({
          posicionamento: resumo.slice(0,600)
        }).eq('user_id', S.user.id);
      } catch(e2) { console.log('sinc p5 empresa:', e2.message); }
    }
  } catch(e) { console.log('sinc p5:', e.message); }
}

async function sincP2Financeiro(resumo) {
  SP.dados.time = resumo;
  // Extrai custo total de pessoal para referência no financeiro
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514', max_tokens:200,
        messages:[{role:'user',content:`Do texto abaixo, some todos os salários/custos mensais mencionados. Responda SOMENTE um número (total em reais, sem R$ ou pontos). Se não houver valores claros, responda 0. TEXTO: ${resumo.slice(0,800)}`}]
      })
    });
    const data = await res.json();
    const total = parseFloat(data.content?.[0]?.text||'0')||0;
    if(total > 0) SP.dados.custo_pessoal = total;
  } catch(e) {}
}

async function sincP3Estoque(resumo) {
  // Extrai produtos do texto usando IA
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages:[{role:'user',content:`Do texto abaixo, extraia APENAS os produtos/serviços com nome e preço mencionados. Responda SOMENTE em JSON array: [{"nome":"...", "preco":0, "tipo":"produto|servico"}]. Se não houver produtos claros, retorne []. TEXTO: ${resumo.slice(0,1000)}`}]
      })
    });
    const data = await res.json();
    const txt = data.content?.[0]?.text||'[]';
    const produtos = JSON.parse(txt.replace(/```json|```/g,'').trim());
    if(produtos.length && S.user) {
      for(const p of produtos.slice(0,5)) {
        if(!p.nome) continue;
        // Verifica se já existe antes de inserir
        const { data:existe } = await sb.from('estoque').select('id').eq('user_id',S.user.id).eq('nome',p.nome).single().catch(()=>({data:null}));
        if(!existe) {
          await sb.from('estoque').insert({
            user_id: S.user.id,
            nome: p.nome,
            categoria: p.tipo||'produto',
            preco_venda: p.preco||0,
            qtd_atual: 0,
            qtd_minima: 0
          }).catch(()=>{});
        }
      }
    }
  } catch(e) { console.log('sinc p3:', e.message); }
}

async function sincP6Metas(resumo) {
  try {
    const res = await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},
      body:JSON.stringify({
        messages:[{role:'user',content:`Do texto abaixo, extraia metas financeiras mensais mencionadas. Responda SOMENTE em JSON: {"meta_receita": numero_ou_null, "limite_despesas": numero_ou_null, "meta_lucro": numero_ou_null}. Apenas números, sem R$. TEXTO: ${resumo.slice(0,800)}`}],
        systemPrompt:'Retorne apenas JSON válido, sem texto adicional.'
      })});
    const data = await res.json();
    const txt = (data.reply||'{}').replace(/```json|```/g,'').trim();
    const metas = JSON.parse(txt);
    if((metas.meta_receita||metas.meta_lucro) && S.user) {
      // Pede autorização antes de salvar no módulo Financeiro
      const autorizado = confirm(`🎯 Deseja salvar as metas no módulo Financeiro?\n\nMeta receita: R$ ${(metas.meta_receita||0).toLocaleString('pt-BR')}/mês\nLimite despesas: R$ ${(metas.limite_despesas||0).toLocaleString('pt-BR')}/mês\nMeta lucro: R$ ${(metas.meta_lucro||0).toLocaleString('pt-BR')}/mês`);
      if(autorizado) {
        const now = new Date();
        const mes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        await sb.from('metas_financeiras').upsert({
          user_id: S.user.id, mes,
          meta_receita: metas.meta_receita||null,
          limite_despesas: metas.limite_despesas||null,
          meta_lucro: metas.meta_lucro||null
        }, {onConflict:'user_id,mes'}).catch(()=>{});
      }
    }
  } catch(e) { console.log('sinc p6:', e.message); }
}

// ── Declarações antecipadas para evitar ReferenceError ──
const EST = { itens: [] };
const METAS = { lista: [] };
const CRM = {
  leads: [],
  view: 'kanban',
  estagios: [
    { id:'novo',       label:'🆕 Novo lead',      cor:'#6366f1' },
    { id:'contato',    label:'📞 Em contato',      cor:'#f59e0b' },
    { id:'proposta',   label:'📄 Proposta',        cor:'#2563eb' },
    { id:'negociacao', label:'🤝 Negociação',      cor:'#8b5cf6' },
    { id:'fechado',    label:'✅ Fechado',          cor:'#10b981' },
    { id:'perdido',    label:'❌ Perdido',          cor:'#ef4444' }
  ]
};

// ── buildFullContext atualizado com dados dos 6Ps ──
function buildFullContext() {
  // Usa a matriz central como fonte única de verdade
  const matrizCtx = matrizParaContexto();
  if(matrizCtx) return matrizCtx;

  // Fallback se matriz ainda não foi populada
  const emp = S.empresa;
  if(!emp) return '';
  const ent = (S.lancamentos||[]).filter(l=>l.tipo==='entrada').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const sai = (S.lancamentos||[]).filter(l=>l.tipo==='saida').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  return `EMPRESA: ${emp.nome} | Setor: ${emp.setor||'—'} | Fase: ${emp.fase||'—'}\n▸ FINANCEIRO: Receitas R$${ent.toFixed(2)} | Despesas R$${sai.toFixed(2)} | Saldo R$${(ent-sai).toFixed(2)}`;
}

function renderDiagramaP4(){
  const etapas=[{label:'Aquisição',cor:'#7c6dfa'},{label:'Venda',cor:'#378add'},{label:'Entrega',cor:'#1D9E75'},{label:'Suporte',cor:'#f7b731'},{label:'Retenção',cor:'#D85A30'}];
  const canvas=document.getElementById('diagrama-canvas');if(!canvas)return;
  canvas.innerHTML=`<svg width="100%" viewBox="0 0 580 80" xmlns="http://www.w3.org/2000/svg">${etapas.map((e,i)=>`<g><rect x="${i*116+2}" y="10" width="108" height="60" rx="8" fill="${e.cor}22" stroke="${e.cor}" stroke-width="1.5"/><text x="${i*116+56}" y="45" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" font-weight="600" fill="${e.cor}">${e.label}</text>${i<4?`<path d="M${i*116+112} 40 L${i*116+118} 40" stroke="${e.cor}" stroke-width="1.5" fill="none"/>`:''}</g>`).join('')}</svg>`;
}

// ══════════════════════════════════════════════
// DASHBOARD MODAL — Filtros dinâmicos
// ══════════════════════════════════════════════
const DASH = {
  platform: null,
  charts: {},
  chartType: 'line',
  dateFrom: null,
  dateTo: null,
  metric: 'engagement',
  segment: 'timeline',
  rawData: {}
};

const DASH_COLORS = {
  facebook:  { main:'#1877F2', name:'Facebook',  icon:'📘' },
  instagram: { main:'#e1306c', name:'Instagram', icon:'📷' },
  whatsapp:  { main:'#25d366', name:'WhatsApp',  icon:'💬' }
};

// Paleta para gráficos de pizza/segmentação
const DASH_PIE_COLORS = [
  '#7c6dfa','#4ecdc4','#f7b731','#ff6b6b','#1877F2',
  '#e1306c','#25d366','#a78bfa','#34d399','#fb923c'
];

function openDashModal(platform) {
  DASH.platform = platform;
  DASH.chartType = 'line';
  DASH.metric = 'engagement';
  DASH.segment = 'timeline';
  DASH.rawData = {};

  // Reset datas para 7 dias
  const today = new Date();
  const from  = new Date(); from.setDate(today.getDate()-7);
  DASH.dateTo   = today.toISOString().slice(0,10);
  DASH.dateFrom = from.toISOString().slice(0,10);

  // Atualiza inputs
  const df = document.getElementById('dash-date-from');
  const dt = document.getElementById('dash-date-to');
  if(df) df.value = DASH.dateFrom;
  if(dt) dt.value = DASH.dateTo;

  // Reset botões de período e gráfico
  document.querySelectorAll('.dash-period-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('dbtn-7d')?.classList.add('active');
  document.querySelectorAll('[id^=dchart-]').forEach(b=>b.classList.remove('active'));
  document.getElementById('dchart-line')?.classList.add('active');

  // Sync selects
  const ms = document.getElementById('dash-filter-metric');
  const ss = document.getElementById('dash-filter-segment');
  if(ms) ms.value = 'engagement';
  if(ss) ss.value = 'timeline';

  const c = DASH_COLORS[platform];
  document.getElementById('dash-modal-title').innerHTML = `<span style="font-size:22px">${c.icon}</span> ${c.name} — Dashboard Analítico`;
  document.getElementById('dash-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Restringe segmentação conforme plataforma
  dashUpdateSegmentOptions(platform);

  dashApplyFilters();
}

function dashUpdateSegmentOptions(platform) {
  const ss = document.getElementById('dash-filter-segment');
  if(!ss) return;
  // WhatsApp não tem demográficos
  const wppOnly = platform === 'whatsapp';
  const opts = ss.querySelectorAll('option');
  opts.forEach(o => {
    if(['age','gender','city','country','content_type'].includes(o.value)) {
      o.disabled = wppOnly;
      o.style.color = wppOnly ? 'var(--muted)' : '';
    }
  });
  if(wppOnly && ['age','gender','city','country','content_type'].includes(ss.value)) ss.value = 'timeline';
}

function closeDashModal() {
  document.getElementById('dash-modal').style.display = 'none';
  document.body.style.overflow = '';
  Object.values(DASH.charts).forEach(c=>{ try{c.destroy();}catch(e){} });
  DASH.charts = {};
}

function dashQuickPeriod(period, btn) {
  document.querySelectorAll('.dash-period-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const today = new Date();
  let from = new Date();
  if(period==='7d')  from.setDate(today.getDate()-7);
  if(period==='30d') from.setDate(today.getDate()-30);
  if(period==='90d') from.setDate(today.getDate()-90);
  if(period==='ano') from = new Date(today.getFullYear(),0,1);
  DASH.dateFrom = from.toISOString().slice(0,10);
  DASH.dateTo   = today.toISOString().slice(0,10);
  const df = document.getElementById('dash-date-from');
  const dt = document.getElementById('dash-date-to');
  if(df) df.value = DASH.dateFrom;
  if(dt) dt.value = DASH.dateTo;
  dashApplyFilters();
}

function dashDateChanged() {
  const df = document.getElementById('dash-date-from')?.value;
  const dt = document.getElementById('dash-date-to')?.value;
  if(df) DASH.dateFrom = df;
  if(dt) DASH.dateTo   = dt;
  // Remove seleção de período rápido
  document.querySelectorAll('.dash-period-btn').forEach(b=>b.classList.remove('active'));
}

function dashSetChartType(type, btn) {
  DASH.chartType = type;
  document.querySelectorAll('[id^=dchart-]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // Se já tem dados, re-renderiza sem buscar API de novo
  if(Object.keys(DASH.rawData).length > 0) {
    dashRenderWithData();
  }
}

function dashApplyFilters() {
  DASH.metric  = document.getElementById('dash-filter-metric')?.value  || 'engagement';
  DASH.segment = document.getElementById('dash-filter-segment')?.value || 'timeline';
  DASH.dateFrom = document.getElementById('dash-date-from')?.value || DASH.dateFrom;
  DASH.dateTo   = document.getElementById('dash-date-to')?.value   || DASH.dateTo;
  DASH.rawData = {}; // Limpa cache para buscar novamente
  Object.values(DASH.charts).forEach(c=>{ try{c.destroy();}catch(e){} });
  DASH.charts = {};
  renderDashModal(DASH.platform);
}

async function renderDashModal(platform) {
  const body = document.getElementById('dash-modal-body');
  body.innerHTML = `<div style="text-align:center;padding:48px;color:var(--muted)">
    <div style="font-size:32px;margin-bottom:12px;animation:spin .8s linear infinite;display:inline-block">⏳</div>
    <div style="font-size:13px">Carregando dados da META...</div>
    <div style="font-size:11px;margin-top:6px;opacity:.6">${DASH.dateFrom} → ${DASH.dateTo}</div>
  </div>`;
  try {
    if(platform==='facebook')  await fetchDashFacebook();
    if(platform==='instagram') await fetchDashInstagram();
    if(platform==='whatsapp')  await fetchDashWhatsApp();
    dashRenderWithData();
  } catch(e) {
    body.innerHTML = `<div style="color:var(--danger);padding:32px;text-align:center;font-size:13px">❌ Erro: ${e.message}</div>`;
  }
}

// ── Busca dados FB ──
async function fetchDashFacebook() {
  const since = DASH.dateFrom;
  const until = DASH.dateTo;

  const [pageRes, insRes, demoAgeRes, demoCityRes] = await Promise.allSettled([
    metaGet('/'+MKT.config.pageId, {fields:'fan_count,followers_count,name,category'}),
    metaGet('/'+MKT.config.pageId+'/insights', {
      metric:'page_post_engagements,page_views_total,page_total_actions,page_video_views,page_fan_adds,page_fans_by_age_gender_unique',
      period:'day', since, until
    }),
    metaGet('/'+MKT.config.pageId+'/insights', {
      metric:'page_fans_gender_age',
      period:'lifetime', since, until
    }),
    metaGet('/'+MKT.config.pageId+'/insights', {
      metric:'page_fans_city',
      period:'lifetime', since, until
    })
  ]);

  const page = pageRes.status==='fulfilled' ? pageRes.value : {};
  const ins  = insRes.status==='fulfilled'  ? insRes.value  : {data:[]};
  const demoAge  = demoAgeRes.status==='fulfilled'  ? demoAgeRes.value  : {data:[]};
  const demoCity = demoCityRes.status==='fulfilled' ? demoCityRes.value : {data:[]};

  const dm={};
  (ins.data||[]).forEach(m=>{ dm[m.name]=m.values||[]; });

  // Processa dias
  const days = dm['page_post_engagements']||[];
  const labels = days.map(d=>{ const dt=new Date(d.end_time||d.date||''); return dt.getDate()+'/'+(dt.getMonth()+1); });

  // Dados demográficos de idade/gênero
  const ageRaw = (demoAge.data||[]).find(m=>m.name==='page_fans_gender_age')?.values?.[0]?.value||{};
  const cityRaw= (demoCity.data||[]).find(m=>m.name==='page_fans_city')?.values?.[0]?.value||{};

  DASH.rawData = {
    platform: 'facebook',
    page,
    labels,
    engagement: (dm['page_post_engagements']||[]).map(v=>v.value||0),
    views:       (dm['page_views_total']||[]).map(v=>v.value||0),
    cta:         (dm['page_total_actions']||[]).map(v=>v.value||0),
    video:       (dm['page_video_views']||[]).map(v=>v.value||0),
    followers:   (dm['page_fan_adds']||[]).map(v=>v.value||0),
    reach:       (dm['page_views_total']||[]).map(v=>v.value||0),
    ageGender:   ageRaw,
    city:        cityRaw,
    totalFans:   page.fan_count||0,
    totalFollowers: page.followers_count||0
  };
}

// ── Busca dados IG ──
async function fetchDashInstagram() {
  const since = DASH.dateFrom;
  const until = DASH.dateTo;

  // Pega IG ID via página
  const pageIg = await metaGet('/'+MKT.config.pageId,{fields:'instagram_business_account'});
  const igId = pageIg.instagram_business_account?.id || MKT.config.igId;

  const [igRes, insRes, mediaRes, demoRes] = await Promise.allSettled([
    metaGet('/'+igId, {fields:'username,followers_count,media_count,biography'}),
    metaGet('/'+igId+'/insights', {
      metric:'reach,impressions,profile_views,website_clicks',
      period:'day', since, until
    }),
    metaGet('/'+igId+'/media', {
      fields:'id,media_type,like_count,comments_count,timestamp,permalink,thumbnail_url',
      limit:20
    }),
    metaGet('/'+igId+'/insights', {
      metric:'follower_demographics',
      period:'lifetime',
      metric_type:'total_value',
      breakdown:'age,gender,city,country'
    })
  ]);

  const ig    = igRes.status==='fulfilled'   ? igRes.value   : {};
  const ins   = insRes.status==='fulfilled'  ? insRes.value  : {data:[]};
  const media = mediaRes.status==='fulfilled'? mediaRes.value: {data:[]};
  const demo  = demoRes.status==='fulfilled' ? demoRes.value : {data:[]};

  const dm={};
  (ins.data||[]).forEach(m=>{ dm[m.name]=m.values||[]; });

  const days = dm['reach']||dm['impressions']||[];
  const labels = days.map(d=>{ const dt=new Date(d.end_time||''); return dt.getDate()+'/'+(dt.getMonth()+1); });

  // Processa demográficos IG v25
  const demoData = {};
  (demo.data||[]).forEach(d=>{
    if(d.name==='follower_demographics'&&d.total_value) {
      (d.total_value.breakdowns||[]).forEach(br=>{
        br.results?.forEach(r=>{
          const key = r.dimension_values?.join('|')||'';
          demoData[key] = r.value||0;
        });
      });
    }
  });

  // Posts performance
  const posts = (media.data||[]).map(m=>({
    date: new Date(m.timestamp).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}),
    type: m.media_type,
    likes: m.like_count||0,
    comments: m.comments_count||0,
    permalink: m.permalink
  }));

  // Tipos de conteúdo
  const typeCount = {};
  (media.data||[]).forEach(m=>{ typeCount[m.media_type]=(typeCount[m.media_type]||0)+1; });

  DASH.rawData = {
    platform: 'instagram',
    ig,
    igId,
    labels,
    reach:      (dm['reach']||[]).map(v=>v.value||0),
    views:      (dm['impressions']||[]).map(v=>v.value||0),
    engagement: (dm['reach']||[]).map(v=>v.value||0),
    followers:  new Array(labels.length).fill(0),
    video:      (dm['impressions']||[]).map(v=>v.value||0),
    cta:        (dm['website_clicks']||[]).map(v=>v.value||0),
    posts,
    typeCount,
    demoData,
    totalFollowers: ig.followers_count||0,
    totalPosts: ig.media_count||0
  };
}

// ── Busca dados WhatsApp ──
async function fetchDashWhatsApp() {
  const adAccount = MKT.config.adAccount || 'act_374471102656220';
  const since = DASH.dateFrom;
  const until = DASH.dateTo;

  const res = await metaGet('/'+adAccount+'/campaigns',{
    fields:'id,name,status,objective,created_time',
    limit:50
  });
  const camps = res.data||[];

  const withIns = await Promise.all(camps.slice(0,20).map(async c=>{
    try{
      const ins=await metaGet('/'+c.id+'/insights',{
        fields:'spend,reach,clicks,impressions,actions,cpm,cpc,frequency',
        time_range: JSON.stringify({since,until})
      });
      const d=ins.data?.[0]||{};
      const conv=(d.actions||[]).find(a=>a.action_type&&(a.action_type.includes('messaging')||a.action_type.includes('whatsapp')||a.action_type.includes('contact')));
      return{...c,spend:parseFloat(d.spend||0),reach:parseInt(d.reach||0),clicks:parseInt(d.clicks||0),impressions:parseInt(d.impressions||0),cpm:parseFloat(d.cpm||0),frequency:parseFloat(d.frequency||0),results:parseInt(conv?.value||0)};
    }catch(e){return{...c,spend:0,reach:0,clicks:0,impressions:0,cpm:0,frequency:0,results:0};}
  }));

  const active = withIns.filter(c=>c.status==='ACTIVE');
  const withData = withIns.filter(c=>c.spend>0||c.reach>0);

  DASH.rawData = {
    platform:'whatsapp',
    campaigns: withIns,
    active,
    withData,
    totalSpend:  withIns.reduce((s,c)=>s+c.spend,0),
    totalConv:   withIns.reduce((s,c)=>s+c.results,0),
    totalClicks: withIns.reduce((s,c)=>s+c.clicks,0),
    totalReach:  withIns.reduce((s,c)=>s+c.reach,0),
    // Timeline simulada por campanha (dados reais são por dia via insights)
    labels: withData.slice(0,8).map(c=>c.name.slice(0,15)+(c.name.length>15?'…':'')),
    engagement: withData.slice(0,8).map(c=>c.clicks),
    reach:      withData.slice(0,8).map(c=>c.reach),
    views:      withData.slice(0,8).map(c=>c.impressions),
    video:      withData.slice(0,8).map(c=>c.results),
    cta:        withData.slice(0,8).map(c=>c.results),
    followers:  withData.slice(0,8).map(c=>c.spend)
  };
}

// ── Renderiza com dados já carregados ──
function dashRenderWithData() {
  const d = DASH.rawData;
  if(!d||!d.platform) return;

  const metric  = DASH.metric;
  const segment = DASH.segment;
  const body    = document.getElementById('dash-modal-body');
  const c       = DASH_COLORS[d.platform];

  // Destroy charts anteriores
  Object.values(DASH.charts).forEach(ch=>{ try{ch.destroy();}catch(e){} });
  DASH.charts = {};

  // ── KPIs ──
  const kpis = dashBuildKPIs(d);

  // ── Dados do gráfico principal baseado em filtros ──
  const { labels, data, chartLabel, extraDatasets } = dashGetChartData(d, metric, segment);

  // ── Dados demográficos / segmentados ──
  const isSegmented = ['age','gender','city','country','content_type'].includes(segment);
  const isPieType   = ['pie','doughnut'].includes(DASH.chartType);
  const mainChartType = isSegmented||isPieType ? (DASH.chartType==='line'?'bar':DASH.chartType) : DASH.chartType;

  body.innerHTML = `
    <!-- KPIs -->
    <div class="dash-kpi-row">${kpis}</div>

    <!-- Gráfico principal -->
    <div class="dash-chart-card">
      <div class="dash-chart-title">
        <span>${dashMetricLabel(metric)} ${dashSegmentLabel(segment)}</span>
        <span style="font-size:11px;color:var(--muted);font-weight:400">${DASH.dateFrom} → ${DASH.dateTo}</span>
      </div>
      <div style="position:relative;height:${isPieType?'300px':'240px'};max-width:${isPieType?'400px':'100%'};margin:0 auto">
        <canvas id="dash-main-chart"></canvas>
      </div>
    </div>

    ${d.platform!=='whatsapp' ? `
    <!-- Gráfico secundário + tabela/lista -->
    <div class="dash-grid-2">
      <div class="dash-chart-card">
        <div class="dash-chart-title">📊 Tipo de conteúdo</div>
        <div style="position:relative;height:200px;max-width:300px;margin:0 auto"><canvas id="dash-type-chart"></canvas></div>
      </div>
      <div class="dash-chart-card" id="dash-detail-card">
        <div class="dash-chart-title">📋 Detalhe</div>
        <div id="dash-detail-content" style="font-size:13px;color:var(--muted)">—</div>
      </div>
    </div>` : `
    <!-- Tabela de campanhas WPP -->
    <div class="dash-chart-card">
      <div class="dash-chart-title">📋 Campanhas — ${DASH.dateFrom} até ${DASH.dateTo}</div>
      ${dashWppTable(d.campaigns||[])}
    </div>`}
  `;

  // Renderiza gráficos
  requestAnimationFrame(()=>{
    // Gráfico principal
    const mainCtx = document.getElementById('dash-main-chart')?.getContext('2d');
    if(mainCtx) {
      const datasets = isPieType||isSegmented ? [{
        data,
        backgroundColor: DASH_PIE_COLORS.slice(0,data.length),
        borderColor: '#12121a',
        borderWidth: 2
      }] : [
        dashLineDataset(chartLabel, data, c.main),
        ...(extraDatasets||[])
      ];
      DASH.charts['main'] = new Chart(mainCtx, {
        type: mainChartType==='line'&&!isPieType&&!isSegmented?'line':mainChartType,
        data: { labels, datasets },
        options: dashChartOptions(isPieType||isSegmented, c.main)
      });
    }

    // Gráfico de tipo de conteúdo
    if(d.platform!=='whatsapp') {
      const typeCtx = document.getElementById('dash-type-chart')?.getContext('2d');
      if(typeCtx) {
        const typeData = dashGetTypeData(d);
        DASH.charts['type'] = new Chart(typeCtx, {
          type: 'doughnut',
          data: {
            labels: typeData.labels,
            datasets:[{ data:typeData.data, backgroundColor:DASH_PIE_COLORS, borderColor:'#12121a', borderWidth:2 }]
          },
          options: dashChartOptions(true, c.main)
        });
      }
      // Detalhe
      const detailEl = document.getElementById('dash-detail-content');
      if(detailEl) detailEl.innerHTML = dashGetDetailHTML(d);
    }
  });
}

// ── Retorna dados para gráfico baseado em métrica + segmentação ──
function dashGetChartData(d, metric, segment) {
  // Segmentações demográficas
  if(segment==='age'||segment==='gender') {
    const raw = d.ageGender||d.demoData||{};
    if(!Object.keys(raw).length) return dashEmptyDemo('idade/gênero');
    if(segment==='age') {
      const ages = {};
      Object.entries(raw).forEach(([k,v])=>{ const age=k.split('.')[1]||k.split('|')[0]||k; ages[age]=(ages[age]||0)+v; });
      const sorted = Object.entries(ages).sort((a,b)=>a[0].localeCompare(b[0]));
      return { labels:sorted.map(([k])=>k), data:sorted.map(([,v])=>v), chartLabel:'Seguidores por faixa etária' };
    } else {
      const genders = {M:0,F:0,U:0};
      Object.entries(raw).forEach(([k,v])=>{ const g=k.split('.')[0]||k.split('|')[1]||'U'; if(genders[g]!==undefined)genders[g]+=v; else genders.U+=v; });
      return { labels:['Masculino','Feminino','Outro'], data:[genders.M,genders.F,genders.U], chartLabel:'Por gênero' };
    }
  }
  if(segment==='city'||segment==='country') {
    const raw = d.city||d.demoData||{};
    if(!Object.keys(raw).length) return dashEmptyDemo('cidade');
    const sorted = Object.entries(raw).sort((a,b)=>b[1]-a[1]).slice(0,10);
    return { labels:sorted.map(([k])=>k), data:sorted.map(([,v])=>v), chartLabel:`Top 10 ${segment==='city'?'cidades':'países'}` };
  }
  if(segment==='content_type') {
    const td = dashGetTypeData(d);
    return { labels:td.labels, data:td.data, chartLabel:'Por tipo de conteúdo' };
  }

  // Timeline
  const metricMap = { engagement:'engagement',reach:'reach',views:'views',followers:'followers',video:'video',cta:'cta' };
  const key = metricMap[metric]||'engagement';
  const data = d[key]||[];
  let extraDatasets = [];

  // Se linha, adiciona segunda série quando faz sentido
  if(DASH.chartType==='line'&&metric==='engagement'&&d.reach) {
    extraDatasets = [dashLineDataset('Alcance/Impressões', d.reach, '#4ecdc4')];
  }

  return { labels:d.labels||[], data, chartLabel:dashMetricLabel(metric), extraDatasets };
}

function dashEmptyDemo(tipo) {
  return {
    labels: ['Dados insuficientes'],
    data: [1],
    chartLabel: `Demográficos de ${tipo} não disponíveis`
  };
}

function dashGetTypeData(d) {
  if(d.platform==='instagram'&&d.typeCount) {
    const typeNames = {IMAGE:'🖼️ Imagem',VIDEO:'🎬 Vídeo',CAROUSEL_ALBUM:'🎠 Carrossel',REEL:'📹 Reels'};
    const entries = Object.entries(d.typeCount);
    return { labels:entries.map(([k])=>typeNames[k]||k), data:entries.map(([,v])=>v) };
  }
  // Facebook: estimado por tipo de engajamento
  return { labels:['📘 Feed','📹 Vídeo','🔗 Link'], data:[60,30,10] };
}

function dashGetDetailHTML(d) {
  if(d.platform==='instagram'&&d.posts?.length) {
    const typeIcons={IMAGE:'🖼️',VIDEO:'🎬',CAROUSEL_ALBUM:'🎠',REEL:'📹'};
    return d.posts.slice(0,6).map(p=>`
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
        <span>${typeIcons[p.type]||'📝'}</span>
        <span style="flex:1;font-size:11px;color:var(--muted)">${p.date}</span>
        <span style="font-size:11px;color:var(--success)">❤️ ${p.likes}</span>
        <span style="font-size:11px;color:var(--muted)">💬 ${p.comments}</span>
        <a href="${p.permalink||'#'}" target="_blank" style="font-size:10px;color:var(--accent)">↗</a>
      </div>`).join('');
  }
  if(d.platform==='facebook') {
    return `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Total seguidores</span><strong>${mktFmt(d.totalFans||0)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Seguidores</span><strong>${mktFmt(d.totalFollowers||0)}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Total engajamentos</span><strong style="color:var(--success)">${mktFmt((d.engagement||[]).reduce((a,b)=>a+b,0))}</strong></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:12px">Total views</span><strong style="color:var(--accent)">${mktFmt((d.views||[]).reduce((a,b)=>a+b,0))}</strong></div>
        <div style="font-size:10px;color:var(--muted);margin-top:8px;padding:8px;background:var(--surface);border-radius:6px;line-height:1.5">Dados demográficos (idade, cidade) disponíveis no filtro de Segmentação ↑</div>
      </div>`;
  }
  return '—';
}

function dashWppTable(campaigns) {
  const stColors={ACTIVE:'var(--success)',PAUSED:'var(--fin)',ARCHIVED:'var(--muted)',DELETED:'var(--danger)'};
  if(!campaigns.length) return '<p style="color:var(--muted);font-size:13px;padding:12px">Nenhuma campanha encontrada no período.</p>';
  return `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="border-bottom:1px solid var(--border)">
      <th style="text-align:left;padding:8px 12px;color:var(--muted);font-size:10px;text-transform:uppercase">Campanha</th>
      <th style="text-align:right;padding:8px 12px;color:var(--muted);font-size:10px;text-transform:uppercase">Status</th>
      <th style="text-align:right;padding:8px 12px;color:var(--muted);font-size:10px;text-transform:uppercase">Investido</th>
      <th style="text-align:right;padding:8px 12px;color:var(--muted);font-size:10px;text-transform:uppercase">Alcance</th>
      <th style="text-align:right;padding:8px 12px;color:var(--muted);font-size:10px;text-transform:uppercase">Cliques</th>
      <th style="text-align:right;padding:8px 12px;color:var(--muted);font-size:10px;text-transform:uppercase">Conversas</th>
    </tr></thead>
    <tbody>${campaigns.map(c=>`
      <tr style="border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        <td style="padding:9px 12px;font-weight:500">${c.name}</td>
        <td style="padding:9px 12px;text-align:right"><span style="color:${stColors[c.status]||'var(--muted)'};font-size:10px;font-weight:700">${c.status}</span></td>
        <td style="padding:9px 12px;text-align:right;font-family:monospace">R$ ${(c.spend||0).toFixed(2)}</td>
        <td style="padding:9px 12px;text-align:right;font-family:monospace">${mktFmt(c.reach||0)}</td>
        <td style="padding:9px 12px;text-align:right;font-family:monospace">${mktFmt(c.clicks||0)}</td>
        <td style="padding:9px 12px;text-align:right;font-weight:700;color:#25d366;font-family:monospace">${c.results||'—'}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

// ── KPIs ──
function dashBuildKPIs(d) {
  const c = DASH_COLORS[d.platform];
  if(d.platform==='facebook') {
    const totEng  = (d.engagement||[]).reduce((a,b)=>a+b,0);
    const totView = (d.views||[]).reduce((a,b)=>a+b,0);
    const totCta  = (d.cta||[]).reduce((a,b)=>a+b,0);
    const totVid  = (d.video||[]).reduce((a,b)=>a+b,0);
    return `
      <div class="dash-kpi" style="border-left:3px solid ${c.main}"><div class="dash-kpi-label">Seguidores</div><div class="dash-kpi-value" style="color:${c.main}">${mktFmt(d.totalFans||0)}</div><div class="dash-kpi-delta" style="color:var(--muted)">total acumulado</div></div>
      <div class="dash-kpi" style="border-left:3px solid var(--accent)"><div class="dash-kpi-label">Views</div><div class="dash-kpi-value" style="color:var(--accent)">${mktFmt(totView)}</div><div class="dash-kpi-delta" style="color:var(--muted)">no período</div></div>
      <div class="dash-kpi" style="border-left:3px solid var(--success)"><div class="dash-kpi-label">Engajamentos</div><div class="dash-kpi-value" style="color:var(--success)">${mktFmt(totEng)}</div><div class="dash-kpi-delta" style="color:var(--muted)">reações + comentários</div></div>
      <div class="dash-kpi" style="border-left:3px solid var(--fin)"><div class="dash-kpi-label">Ações CTA</div><div class="dash-kpi-value" style="color:var(--fin)">${mktFmt(totCta)}</div><div class="dash-kpi-delta" style="color:var(--muted)">cliques em contato</div></div>`;
  }
  if(d.platform==='instagram') {
    const totReach = (d.reach||[]).reduce((a,b)=>a+b,0);
    const totImp   = (d.views||[]).reduce((a,b)=>a+b,0);
    const totLikes = (d.posts||[]).reduce((s,p)=>s+p.likes,0);
    return `
      <div class="dash-kpi" style="border-left:3px solid ${c.main}"><div class="dash-kpi-label">Seguidores</div><div class="dash-kpi-value" style="color:${c.main}">${mktFmt(d.totalFollowers||0)}</div><div class="dash-kpi-delta" style="color:var(--muted)">@${d.ig?.username||''}</div></div>
      <div class="dash-kpi" style="border-left:3px solid var(--accent)"><div class="dash-kpi-label">Alcance</div><div class="dash-kpi-value" style="color:var(--accent)">${mktFmt(totReach)}</div><div class="dash-kpi-delta" style="color:var(--muted)">pessoas únicas</div></div>
      <div class="dash-kpi" style="border-left:3px solid var(--success)"><div class="dash-kpi-label">Curtidas (posts)</div><div class="dash-kpi-value" style="color:var(--success)">${mktFmt(totLikes)}</div><div class="dash-kpi-delta" style="color:var(--muted)">${d.posts?.length||0} posts analisados</div></div>
      <div class="dash-kpi" style="border-left:3px solid var(--fin)"><div class="dash-kpi-label">Total posts</div><div class="dash-kpi-value" style="color:var(--fin)">${mktFmt(d.totalPosts||0)}</div><div class="dash-kpi-delta" style="color:var(--muted)">publicações na conta</div></div>`;
  }
  if(d.platform==='whatsapp') {
    const cpc = d.totalConv>0&&d.totalSpend>0?(d.totalSpend/d.totalConv):0;
    return `
      <div class="dash-kpi" style="border-left:3px solid ${c.main}"><div class="dash-kpi-label">Conversas iniciadas</div><div class="dash-kpi-value" style="color:${c.main}">${mktFmt(d.totalConv)||'—'}</div><div class="dash-kpi-delta" style="color:var(--muted)">Click-to-WhatsApp</div></div>
      <div class="dash-kpi" style="border-left:3px solid var(--fin)"><div class="dash-kpi-label">Investido</div><div class="dash-kpi-value" style="color:var(--fin)">R$ ${(d.totalSpend||0).toFixed(0)}</div><div class="dash-kpi-delta" style="color:var(--muted)">${d.withData?.length||0} campanhas</div></div>
      <div class="dash-kpi" style="border-left:3px solid var(--accent)"><div class="dash-kpi-label">Custo/conversa</div><div class="dash-kpi-value" style="color:var(--accent)">${cpc>0?'R$ '+cpc.toFixed(2):'—'}</div><div class="dash-kpi-delta" style="color:var(--muted)">custo por resultado</div></div>
      <div class="dash-kpi" style="border-left:3px solid var(--success)"><div class="dash-kpi-label">Alcance total</div><div class="dash-kpi-value" style="color:var(--success)">${mktFmt(d.totalReach||0)}</div><div class="dash-kpi-delta" style="color:var(--muted)">${mktFmt(d.totalClicks||0)} cliques</div></div>`;
  }
  return '';
}

// ── Labels de exibição ──
function dashMetricLabel(m) {
  const map={engagement:'❤️ Engajamento',reach:'👥 Alcance',views:'👁️ Views/Impressões',followers:'➕ Novos Seguidores',video:'📹 Vídeos',cta:'👆 Ações CTA'};
  return map[m]||m;
}
function dashSegmentLabel(s) {
  const map={timeline:'— Evolução',age:'— Por Faixa Etária',gender:'— Por Gênero',city:'— Por Cidade',country:'— Por País',content_type:'— Por Tipo de Conteúdo'};
  return map[s]||'';
}

// ── Config padrão Chart.js ──
function dashChartOptions(isPie, color) {
  if(isPie) return {
    responsive:true, maintainAspectRatio:false,
    plugins:{
      legend:{ position:'right', labels:{ color:'#8080a0', font:{size:11}, boxWidth:14, padding:12 } },
      tooltip:{ backgroundColor:'#1a1a26', titleColor:'#f0f0f5', bodyColor:'#8080a0', borderColor:'rgba(255,255,255,.1)', borderWidth:1 }
    }
  };
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{
      legend:{ labels:{ color:'#8080a0', font:{size:11}, boxWidth:12 } },
      tooltip:{ backgroundColor:'#1a1a26', titleColor:'#f0f0f5', bodyColor:'#8080a0', borderColor:'rgba(255,255,255,.1)', borderWidth:1 }
    },
    scales:{
      x:{ grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'#8080a0',font:{size:10}} },
      y:{ grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'#8080a0',font:{size:10}}, beginAtZero:true }
    }
  };
}

function dashLineDataset(label, data, color) {
  return { label, data, borderColor:color, backgroundColor:color+'22', tension:.4, fill:true, pointRadius:3, pointHoverRadius:6, borderWidth:2 };
}
function dashBarDataset(label, data, color) {
  return { label, data, backgroundColor:color+'bb', borderColor:color, borderWidth:1, borderRadius:4 };
}

// Fix WhatsApp — sempre usa Ad Account correto independente do localStorage
function mktLoadWhatsAppFixed(){
  MKT.config.adAccount = MKT.config.adAccount || 'act_374471102656220';
  mktLoadWhatsApp();
}

// ══════════════════════════════════════════════
// GOOGLE CALENDAR
// ══════════════════════════════════════════════

function gcalInit() {
  if(gcalInited) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if(typeof gapi === 'undefined') { reject(new Error('Google API não carregada')); return; }
    gapi.load('client:auth2', async () => {
      try {
        await gapi.client.init({
          apiKey: GCAL_API_KEY,
          clientId: GCAL_CLIENT_ID,
          discoveryDocs: [GCAL_DISCOVERY],
          scope: GCAL_SCOPE
        });
        gcalInited = true;
        gcalAuthorized = gapi.auth2.getAuthInstance().isSignedIn.get();
        resolve();
      } catch(e) { reject(e); }
    });
  });
}

async function gcalLogin() {
  await gcalInit();
  if(!gcalAuthorized) {
    await gapi.auth2.getAuthInstance().signIn();
    gcalAuthorized = true;
  }
}

async function gcalCriarEvento(evento) {
  await gcalLogin();
  const clienteNome = evento.cliente_id ? cronoNomeCliente(evento.cliente_id) : 'DigitalMind';
  const tipoIcon = TIPO_ICONS[evento.tipo] || '📌';

  const dtInicio = `${evento.data_inicio}T${evento.hora_inicio||'09:00'}:00`;
  const dtFim    = `${evento.data_inicio}T${evento.hora_fim||'10:00'}:00`;

  const gcalEvento = {
    summary: `${tipoIcon} ${evento.titulo} — ${clienteNome}`,
    description: [
      `Cliente: ${clienteNome}`,
      `Tipo: ${evento.tipo}`,
      `Plataforma: ${evento.plataforma}`,
      `Urgência: ${evento.urgencia}`,
      evento.prazo ? `Prazo: ${evento.prazo}` : '',
      evento.descricao ? `\nBriefing:\n${evento.descricao}` : ''
    ].filter(Boolean).join('\n'),
    start: { dateTime: dtInicio, timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: dtFim,    timeZone: 'America/Sao_Paulo' },
    colorId: gcalCorCliente(evento.cliente_id),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'email', minutes: 1440 }
      ]
    }
  };

  // Se já tem evento no GCal, atualiza; senão cria
  let res;
  if(evento.gcal_event_id) {
    res = await gapi.client.calendar.events.update({
      calendarId: 'primary',
      eventId: evento.gcal_event_id,
      resource: gcalEvento
    });
  } else {
    res = await gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: gcalEvento
    });
  }
  return res.result;
}

function gcalCorCliente(clienteId) {
  // Google Calendar color IDs 1-11
  if(!clienteId) return '1';
  const cores = ['1','2','3','4','5','6','7','8','9','10','11'];
  const idx = CRONO.clientes.findIndex(c => String(c.id) === String(clienteId));
  return cores[idx >= 0 ? idx % cores.length : 0];
}

async function cronoSincronizarGCal() {
  const btn = document.getElementById('crono-gcal-btn');
  const statusEl = document.getElementById('crono-gcal-status');
  const infoEl = document.getElementById('crono-gcal-info');

  if(!btn || !statusEl) return;

  // Pega o evento atual editado
  const eventoId = CRONO.editandoId;
  const evento = eventoId ? CRONO.eventos.find(e => String(e.id) === String(eventoId)) : null;

  if(!evento) {
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(255,107,107,.1)';
    statusEl.style.color = 'var(--danger)';
    statusEl.style.border = '1px solid rgba(255,107,107,.3)';
    statusEl.textContent = '⚠️ Salve o agendamento primeiro.';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Sincronizando...';
  statusEl.style.display = 'block';
  statusEl.style.background = 'rgba(124,109,250,.1)';
  statusEl.style.color = 'var(--accent)';
  statusEl.style.border = '1px solid rgba(124,109,250,.3)';
  statusEl.textContent = '🔐 Conectando com Google...';

  try {
    const gcalEvt = await gcalCriarEvento(evento);

    // Salva o ID do evento do GCal no Supabase
    await sb.from('cronograma').update({ gcal_event_id: gcalEvt.id }).eq('id', evento.id);
    const idx = CRONO.eventos.findIndex(e => String(e.id) === String(evento.id));
    if(idx >= 0) CRONO.eventos[idx].gcal_event_id = gcalEvt.id;

    // Atualiza UI
    statusEl.style.background = 'rgba(46,204,113,.1)';
    statusEl.style.color = 'var(--success)';
    statusEl.style.border = '1px solid rgba(46,204,113,.3)';
    statusEl.textContent = '✅ Sincronizado com Google Agenda!';

    // Mostra link
    const linkEl = document.getElementById('crono-gcal-link');
    const linkA  = document.getElementById('crono-gcal-link-a');
    if(linkEl && linkA) {
      linkA.href = gcalEvt.htmlLink || '#';
      linkEl.style.display = 'block';
    }
    if(infoEl) infoEl.textContent = '✅ Visível na agenda compartilhada do time.';

    document.getElementById('crono-gcal-event-id').value = gcalEvt.id;

  } catch(e) {
    statusEl.style.background = 'rgba(255,107,107,.1)';
    statusEl.style.color = 'var(--danger)';
    statusEl.style.border = '1px solid rgba(255,107,107,.3)';
    statusEl.textContent = '❌ Erro: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<img src="https://www.google.com/favicon.ico" style="width:14px;height:14px;vertical-align:middle;margin-right:4px">Sincronizar Google Agenda';
  }
}

// ══════════════════════════════════════════════
// CRONOGRAMA
// ══════════════════════════════════════════════
const CRONO = {
  view: 'mes',
  data: new Date(),
  eventos: [],
  editandoId: null,
  clientes: [],
  // Paleta de cores por cliente (gerada automaticamente)
  cores: ['#7c6dfa','#4ecdc4','#f7b731','#ff6b6b','#1877F2','#e1306c','#25d366','#a78bfa','#34d399','#fb923c','#06b6d4','#ec4899']
};

const URGENCIA_CORES = { baixa:'#22c55e', media:'#f59e0b', alta:'#f97316', urgente:'#ef4444' };
const TIPO_ICONS = { gravacao:'🎬', edicao:'✂️', reuniao:'📋', entrega:'📤', foto:'📷', briefing:'📝', outro:'📌' };

function initCronograma() {
  cronoCarregarEventos();
  cronoPreencherClientesSel();
  cronoRenderizar();
}

async function cronoCarregarEventos() {
  try {
    const { data } = await sb.from('cronograma').select('*')
      .eq('user_id', S.user.id)
      .order('data_inicio', { ascending: true });
    CRONO.eventos = data || [];
    cronoRenderizar();
  } catch(e) {
    // Se tabela não existe ainda, usa array vazio
    CRONO.eventos = [];
    cronoRenderizar();
  }
}

async function cronoPreencherClientesSel() {
  // Admin vê todos os clientes; cliente vê só o próprio
  try {
    const { data } = await sb.from('empresas').select('id,nome').order('nome');
    CRONO.clientes = data || [];
    const sel = document.getElementById('crono-cliente-sel');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione o cliente...</option>' +
      CRONO.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  } catch(e) {}
}

function cronoCorCliente(clienteId) {
  if (!clienteId) return '#7c6dfa';
  const idx = CRONO.clientes.findIndex(c => String(c.id) === String(clienteId));
  return CRONO.cores[idx >= 0 ? idx % CRONO.cores.length : 0];
}

function cronoNomeCliente(clienteId) {
  const c = CRONO.clientes.find(c => String(c.id) === String(clienteId));
  return c ? c.nome : (S.empresa?.nome || 'Minha empresa');
}

function cronoSetView(view, btn) {
  CRONO.view = view;
  document.querySelectorAll('[id^=crono-view-]').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.getElementById('crono-view-mes-panel').style.display    = view==='mes'    ? 'block' : 'none';
  document.getElementById('crono-view-semana-panel').style.display = view==='semana' ? 'block' : 'none';
  document.getElementById('crono-view-lista-panel').style.display  = view==='lista'  ? 'block' : 'none';
  cronoRenderizar();
}

function cronoNavMes(dir) {
  if (CRONO.view === 'semana') {
    CRONO.data.setDate(CRONO.data.getDate() + dir * 7);
  } else {
    CRONO.data.setMonth(CRONO.data.getMonth() + dir);
  }
  cronoRenderizar();
}

function cronoRenderizar() {
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const d = CRONO.data;

  if (CRONO.view === 'mes') {
    document.getElementById('crono-titulo').textContent = MESES[d.getMonth()] + ' ' + d.getFullYear();
    cronoRenderMes();
  } else if (CRONO.view === 'semana') {
    const seg = new Date(d);
    seg.setDate(d.getDate() - d.getDay() + 1);
    const sab = new Date(seg); sab.setDate(seg.getDate() + 6);
    document.getElementById('crono-titulo').textContent =
      seg.getDate()+'/'+(seg.getMonth()+1) + ' → ' + sab.getDate()+'/'+(sab.getMonth()+1)+'/'+sab.getFullYear();
    cronoRenderSemana(seg);
  } else {
    document.getElementById('crono-titulo').textContent = 'Próximos agendamentos';
    cronoRenderLista();
  }
  cronoRenderLegenda();
}

function cronoRenderMes() {
  const d = CRONO.data;
  const y = d.getFullYear(), m = d.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev  = new Date(y, m, 0).getDate();
  const today = new Date();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  let html = '';
  for (let i = 0; i < totalCells; i++) {
    let day, isOther = false, isToday = false;
    if (i < firstDay) { day = daysInPrev - firstDay + i + 1; isOther = true; }
    else if (i >= firstDay + daysInMonth) { day = i - firstDay - daysInMonth + 1; isOther = true; }
    else {
      day = i - firstDay + 1;
      isToday = today.getDate()===day && today.getMonth()===m && today.getFullYear()===y;
    }
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayEvts = isOther ? [] : CRONO.eventos.filter(e => e.data_inicio?.slice(0,10) === dateStr);
    const maxShow = 3;
    const extra = dayEvts.length - maxShow;

    html += `<div class="crono-cell${isOther?' outro-mes':''}${isToday?' hoje':''}" onclick="cronoClicarDia('${dateStr}')">
      <div class="crono-date-num">${day}</div>
      ${dayEvts.slice(0, maxShow).map(e => {
        const cor = cronoCorCliente(e.cliente_id);
        return `<div class="crono-evento" style="background:${cor}22;color:${cor};border-left:2px solid ${cor}"
          onclick="event.stopPropagation();cronoAbrirEditar('${e.id}')"
          title="${e.titulo} — ${cronoNomeCliente(e.cliente_id)} ${e.hora_inicio||''}">
          ${TIPO_ICONS[e.tipo]||'📌'} ${e.titulo}
        </div>`;
      }).join('')}
      ${extra > 0 ? `<div class="crono-evento" style="background:var(--surface2);color:var(--muted);text-align:center">+${extra} mais</div>` : ''}
    </div>`;
  }
  document.getElementById('crono-cal-body').innerHTML = html;
}

function cronoRenderSemana(seg) {
  const horas = Array.from({length:14}, (_,i)=>i+8); // 08:00 → 21:00
  const dias = Array.from({length:7}, (_,i)=>{ const d=new Date(seg); d.setDate(seg.getDate()+i); return d; });
  const hoje = new Date();
  const DIAS_SEMANA = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  let html = `<div style="display:grid;grid-template-columns:60px repeat(7,1fr)">
    <div style="border-bottom:1px solid var(--border);border-right:1px solid var(--border)"></div>
    ${dias.map((d,i)=>{
      const isHoje = d.toDateString()===hoje.toDateString();
      return `<div style="text-align:center;padding:10px 4px;font-size:11px;font-weight:700;border-bottom:1px solid var(--border);border-right:1px solid var(--border);color:${isHoje?'var(--accent)':'var(--muted)'};background:${isHoje?'rgba(124,109,250,.06)':''}">
        ${DIAS_SEMANA[i]}<br><span style="font-size:16px;color:${isHoje?'var(--accent)':'var(--text)'}">${d.getDate()}</span>
      </div>`;
    }).join('')}
  </div>`;

  horas.forEach(h => {
    html += `<div style="display:grid;grid-template-columns:60px repeat(7,1fr)">
      <div style="font-size:10px;color:var(--muted);padding:4px 6px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);text-align:right;font-family:monospace">${h}:00</div>
      ${dias.map(d => {
        const dateStr = d.toISOString().slice(0,10);
        const horaStr = String(h).padStart(2,'0')+':00';
        const slot = CRONO.eventos.filter(e =>
          e.data_inicio?.slice(0,10) === dateStr &&
          e.hora_inicio >= horaStr &&
          e.hora_inicio < String(h+1).padStart(2,'0')+':00'
        );
        return `<div style="border-right:1px solid var(--border);border-bottom:1px solid var(--border);min-height:44px;cursor:pointer;padding:2px;transition:background .15s" onmouseover="this.style.background='rgba(124,109,250,.04)'" onmouseout="this.style.background=''" onclick="cronoClicarHora('${dateStr}','${horaStr}')">
          ${slot.map(e=>{
            const cor=cronoCorCliente(e.cliente_id);
            return `<div class="crono-evento" style="background:${cor}22;color:${cor};border-left:2px solid ${cor}" onclick="event.stopPropagation();cronoAbrirEditar('${e.id}')">${TIPO_ICONS[e.tipo]||'📌'} ${e.titulo}</div>`;
          }).join('')}
        </div>`;
      }).join('')}
    </div>`;
  });

  document.getElementById('crono-semana-body').innerHTML = html;
}

function cronoRenderLista() {
  const hoje = new Date();
  const futuros = CRONO.eventos
    .filter(e => new Date(e.data_inicio) >= hoje)
    .sort((a,b) => new Date(a.data_inicio)-new Date(b.data_inicio));

  if (!futuros.length) {
    document.getElementById('crono-lista-body').innerHTML =
      '<div style="color:var(--muted);font-size:13px;text-align:center;padding:32px">Nenhum agendamento futuro. Clique em "+ Novo agendamento" para criar.</div>';
    return;
  }

  document.getElementById('crono-lista-body').innerHTML = futuros.map(e => {
    const cor = cronoCorCliente(e.cliente_id);
    const urgCor = URGENCIA_CORES[e.urgencia] || URGENCIA_CORES.media;
    const dataFmt = new Date(e.data_inicio+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
    return `<div class="crono-list-item" onclick="cronoAbrirEditar('${e.id}')">
      <div class="crono-list-bar" style="background:${cor};min-height:48px"></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:16px">${TIPO_ICONS[e.tipo]||'📌'}</span>
          <span style="font-weight:700;font-size:13px">${e.titulo}</span>
          <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${urgCor}22;color:${urgCor};font-weight:700">${e.urgencia||'média'}</span>
        </div>
        <div style="font-size:12px;color:var(--muted)">${dataFmt} ${e.hora_inicio?'· '+e.hora_inicio:''} ${e.hora_fim?'→ '+e.hora_fim:''}</div>
        ${e.descricao?`<div style="font-size:11px;color:var(--muted);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:400px">${e.descricao}</div>`:''}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:12px;font-weight:700;color:${cor}">${cronoNomeCliente(e.cliente_id)}</div>
        ${e.prazo?`<div style="font-size:10px;color:var(--muted);margin-top:2px">prazo: ${new Date(e.prazo+'T12:00:00').toLocaleDateString('pt-BR')}</div>`:''}
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${e.plataforma||''}</div>
      </div>
    </div>`;
  }).join('');
}

function cronoRenderLegenda() {
  const usados = [...new Set(CRONO.eventos.map(e=>e.cliente_id).filter(Boolean))];
  const leg = document.getElementById('crono-legenda');
  if (!leg) return;
  leg.innerHTML = usados.map(id => {
    const cor = cronoCorCliente(id);
    const nome = cronoNomeCliente(id);
    return `<span style="display:flex;align-items:center;gap:5px;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;background:${cor}22;color:${cor};border:1px solid ${cor}44">
      <span style="width:8px;height:8px;border-radius:50%;background:${cor}"></span>${nome}
    </span>`;
  }).join('');
}

// ── Abrir modal ──
function cronoAbrirModal(data='', hora='') {
  CRONO.editandoId = null;
  const gcalBtn = document.getElementById('crono-gcal-btn');
  const gcalStatus = document.getElementById('crono-gcal-status');
  const gcalLink = document.getElementById('crono-gcal-link');
  if(gcalBtn) gcalBtn.style.display='none';
  if(gcalStatus) gcalStatus.style.display='none';
  if(gcalLink) gcalLink.style.display='none';
  document.getElementById('crono-excluir-btn').style.display = 'none';
  document.getElementById('crono-colisao-warn').style.display = 'none';
  document.getElementById('crono-gcal-event-id').value = '';
  document.getElementById('crono-gcal-info').textContent = 'Após salvar, clique em "Sincronizar Google Agenda" para enviar para a agenda compartilhada do time.';
  document.getElementById('crono-titulo-input').value = '';
  document.getElementById('crono-data').value = data || new Date().toISOString().slice(0,10);
  document.getElementById('crono-hora-inicio').value = hora || '09:00';
  document.getElementById('crono-hora-fim').value = hora ? String(parseInt(hora)+1).padStart(2,'0')+':00' : '10:00';
  document.getElementById('crono-tipo').value = 'gravacao';
  document.getElementById('crono-plataforma').value = 'todas';
  document.getElementById('crono-urgencia').value = 'media';
  document.getElementById('crono-prazo').value = '';
  document.getElementById('crono-descricao').value = '';
  const sel = document.getElementById('crono-cliente-sel');
  if (sel && S.empresa?.id) sel.value = S.empresa.id;
  openModal('modal-cronograma');
}

function cronoClicarDia(dateStr) { cronoAbrirModal(dateStr); }
function cronoClicarHora(dateStr, hora) { cronoAbrirModal(dateStr, hora); }

function cronoAbrirEditar(id) {
  const e = CRONO.eventos.find(ev => String(ev.id) === String(id));
  if (!e) return;
  CRONO.editandoId = id;
  document.getElementById('crono-excluir-btn').style.display = 'inline-flex';
  document.getElementById('crono-colisao-warn').style.display = 'none';
  document.getElementById('crono-titulo-input').value = e.titulo || '';
  document.getElementById('crono-data').value = e.data_inicio?.slice(0,10) || '';
  document.getElementById('crono-hora-inicio').value = e.hora_inicio || '09:00';
  document.getElementById('crono-hora-fim').value = e.hora_fim || '10:00';
  document.getElementById('crono-tipo').value = e.tipo || 'gravacao';
  document.getElementById('crono-plataforma').value = e.plataforma || 'todas';
  document.getElementById('crono-urgencia').value = e.urgencia || 'media';
  document.getElementById('crono-prazo').value = e.prazo || '';
  document.getElementById('crono-descricao').value = e.descricao || '';
  document.getElementById('crono-gcal-event-id').value = e.gcal_event_id || '';
  const sel = document.getElementById('crono-cliente-sel');
  if (sel) sel.value = e.cliente_id || '';

  // Mostra botão GCal e link se já sincronizado
  const gcalBtn = document.getElementById('crono-gcal-btn');
  const gcalStatus = document.getElementById('crono-gcal-status');
  const gcalLink = document.getElementById('crono-gcal-link');
  const gcalInfo = document.getElementById('crono-gcal-info');
  if(gcalBtn) gcalBtn.style.display='inline-flex';
  if(gcalStatus) gcalStatus.style.display='none';
  if(e.gcal_event_id) {
    if(gcalInfo) gcalInfo.textContent='✅ Já sincronizado com Google Agenda.';
    if(gcalLink) {
      gcalLink.style.display='block';
      const a=document.getElementById('crono-gcal-link-a');
      if(a) a.href=`https://calendar.google.com/calendar/r/event?eid=${btoa(e.gcal_event_id)}`;
    }
  } else {
    if(gcalInfo) gcalInfo.textContent='Clique em "Sincronizar Google Agenda" para enviar para a agenda compartilhada do time.';
    if(gcalLink) gcalLink.style.display='none';
  }
  openModal('modal-cronograma');
}

// ── Verificar colisão ──
function cronoVerificarColisao(data, horaInicio, horaFim, excludeId=null) {
  return CRONO.eventos.filter(e => {
    if (String(e.id) === String(excludeId)) return false;
    if (e.data_inicio?.slice(0,10) !== data) return false;
    if (!e.hora_inicio || !e.hora_fim) return false;
    // Verifica sobreposição de horário
    return horaInicio < e.hora_fim && horaFim > e.hora_inicio;
  });
}

// ── Salvar ──
async function cronoSalvar() {
  const titulo     = document.getElementById('crono-titulo-input').value.trim();
  const clienteId  = document.getElementById('crono-cliente-sel').value;
  const data       = document.getElementById('crono-data').value;
  const horaInicio = document.getElementById('crono-hora-inicio').value;
  const horaFim    = document.getElementById('crono-hora-fim').value;
  const tipo       = document.getElementById('crono-tipo').value;
  const plataforma = document.getElementById('crono-plataforma').value;
  const urgencia   = document.getElementById('crono-urgencia').value;
  const prazo      = document.getElementById('crono-prazo').value;
  const descricao  = document.getElementById('crono-descricao').value;

  if (!titulo) { alert('Informe o título do agendamento.'); return; }
  if (!data)   { alert('Informe a data.'); return; }
  if (horaInicio && horaFim && horaInicio >= horaFim) { alert('Hora fim deve ser maior que hora início.'); return; }

  // Verifica colisão
  const colisoes = cronoVerificarColisao(data, horaInicio, horaFim, CRONO.editandoId);
  if (colisoes.length > 0) {
    const warn = document.getElementById('crono-colisao-warn');
    const msg  = document.getElementById('crono-colisao-msg');
    msg.textContent = `Conflito com "${colisoes[0].titulo}" (${colisoes[0].hora_inicio}–${colisoes[0].hora_fim}) — ${cronoNomeCliente(colisoes[0].cliente_id)}. Ajuste o horário.`;
    warn.style.display = 'flex';
    return;
  }

  const payload = {
    user_id: S.user.id,
    cliente_id: clienteId || null,
    titulo, data_inicio: data, hora_inicio: horaInicio, hora_fim: horaFim,
    tipo, plataforma, urgencia, prazo: prazo||null, descricao
  };

  try {
    if (CRONO.editandoId) {
      await sb.from('cronograma').update(payload).eq('id', CRONO.editandoId);
      const idx = CRONO.eventos.findIndex(e => String(e.id) === String(CRONO.editandoId));
      if (idx >= 0) CRONO.eventos[idx] = { ...CRONO.eventos[idx], ...payload };
    } else {
      const { data: novo } = await sb.from('cronograma').insert(payload).select().single();
      if (novo) {
        CRONO.eventos.push(novo);
        CRONO.editandoId = String(novo.id);
      }
    }
    cronoRenderizar();

    // Mostra botão de sincronização GCal sem fechar o modal
    const gcalBtn = document.getElementById('crono-gcal-btn');
    if(gcalBtn) gcalBtn.style.display='inline-flex';
    const gcalStatus = document.getElementById('crono-gcal-status');
    if(gcalStatus) {
      gcalStatus.style.display='block';
      gcalStatus.style.background='rgba(46,204,113,.1)';
      gcalStatus.style.color='var(--success)';
      gcalStatus.style.border='1px solid rgba(46,204,113,.3)';
      gcalStatus.textContent='✅ Salvo! Clique em "Sincronizar Google Agenda" para enviar ao time.';
    }
    // Atualiza botão salvar
    const saveBtn = document.querySelector('[onclick="cronoSalvar()"]');
    if(saveBtn){ const orig=saveBtn.textContent; saveBtn.textContent='✅ Salvo!'; saveBtn.style.background='var(--success)'; setTimeout(()=>{saveBtn.textContent=orig;saveBtn.style.background='';},2000); }

  } catch(e) {
    alert('Erro ao salvar: '+e.message);
  }
}

async function cronoExcluir() {
  if (!CRONO.editandoId) return;
  if (!confirm('Excluir este agendamento?')) return;
  try {
    await sb.from('cronograma').delete().eq('id', CRONO.editandoId);
    CRONO.eventos = CRONO.eventos.filter(e => String(e.id) !== String(CRONO.editandoId));
    closeModal('modal-cronograma');
    cronoRenderizar();
  } catch(e) { alert('Erro ao excluir: '+e.message); }
}

// ══════════════════════════════════════════════
// ESTOQUE
// ══════════════════════════════════════════════

async function estoqueCarregar() {
  const { data } = await sb.from('estoque').select('*').eq('user_id', S.user.id).order('nome');
  EST.itens = data || [];
  estoqueRender();
  estoqueKPIs();
}

function estoqueKPIs() {
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set('estoque-total', EST.itens.length);
  const valor = EST.itens.reduce((s, p) => s + (p.qtd_atual||0)*(p.custo_unit||0), 0);
  set('estoque-valor', 'R$ ' + valor.toFixed(2));
  const critico = EST.itens.filter(p => (p.qtd_atual||0) <= (p.qtd_minima||0)).length;
  set('estoque-critico', critico);
}

function estoqueRender() {
  const tb = document.getElementById('tb-estoque'); if(!tb) return;
  const busca = document.getElementById('estoque-busca')?.value.toLowerCase()||'';
  const cat = document.getElementById('estoque-cat-filtro')?.value||'';
  let itens = EST.itens.filter(p =>
    (!busca || p.nome?.toLowerCase().includes(busca) || p.sku?.toLowerCase().includes(busca)) &&
    (!cat || p.categoria === cat)
  );
  if(!itens.length) { tb.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">Nenhum produto encontrado</td></tr>'; return; }
  tb.innerHTML = itens.map(p => {
    const critico = (p.qtd_atual||0) <= (p.qtd_minima||0);
    const status = critico
      ? `<span class="tag" style="background:rgba(239,68,68,.15);color:var(--danger)">⚠️ Crítico</span>`
      : `<span class="tag entrada">OK</span>`;
    const valorTotal = ((p.qtd_atual||0)*(p.custo_unit||0)).toFixed(2);
    return `<tr>
      <td style="font-weight:600">${p.nome||'—'}</td>
      <td style="color:var(--muted);font-size:11px">${p.sku||'—'}</td>
      <td><span class="tag pendente">${p.categoria||'—'}</span></td>
      <td style="font-weight:700;color:${critico?'var(--danger)':'var(--success)'}">${p.qtd_atual||0}</td>
      <td style="color:var(--muted)">${p.qtd_minima||0}</td>
      <td>R$ ${(p.custo_unit||0).toFixed(2)}</td>
      <td style="font-weight:600">R$ ${valorTotal}</td>
      <td>${status}</td>
      <td style="display:flex;gap:4px">
        <button class="btn btn-ghost btn-sm" onclick="estoqueEntrada(${p.id},'${p.nome}')">+</button>
        <button class="btn btn-ghost btn-sm" onclick="estoqueSaida(${p.id},'${p.nome}')">−</button>
        <button class="btn btn-ghost btn-sm" onclick="estoqueEditar(${p.id})">✏️</button>
      </td>
    </tr>`;
  }).join('');
}

function estoqueEditar(id) {
  const p = EST.itens.find(i=>i.id===id); if(!p) return;
  document.getElementById('est-id').value = p.id;
  document.getElementById('est-nome').value = p.nome||'';
  document.getElementById('est-sku').value = p.sku||'';
  document.getElementById('est-cat').value = p.categoria||'produto';
  document.getElementById('est-qtd').value = p.qtd_atual||0;
  document.getElementById('est-min').value = p.qtd_minima||0;
  document.getElementById('est-custo').value = p.custo_unit||0;
  document.getElementById('est-preco').value = p.preco_venda||0;
  document.getElementById('est-forn').value = p.fornecedor||'';
  document.getElementById('est-del-btn').style.display = 'inline-flex';
  openModal('modal-estoque');
}

async function estoqueSalvar() {
  const id = document.getElementById('est-id').value;
  const payload = {
    user_id: S.user.id,
    nome: document.getElementById('est-nome').value.trim(),
    sku: document.getElementById('est-sku').value.trim(),
    categoria: document.getElementById('est-cat').value,
    qtd_atual: parseInt(document.getElementById('est-qtd').value)||0,
    qtd_minima: parseInt(document.getElementById('est-min').value)||0,
    custo_unit: parseFloat(document.getElementById('est-custo').value)||0,
    preco_venda: parseFloat(document.getElementById('est-preco').value)||0,
    fornecedor: document.getElementById('est-forn').value.trim()
  };
  if(!payload.nome) { alert('Informe o nome do produto.'); return; }
  try {
    if(id) {
      await sb.from('estoque').update(payload).eq('id', id);
    } else {
      await sb.from('estoque').insert(payload);
    }
    closeModal('modal-estoque');
    document.getElementById('est-id').value = '';
    document.getElementById('est-del-btn').style.display = 'none';
    await estoqueCarregar();
  } catch(e) { alert('Erro: '+e.message); }
}

async function estoqueExcluir() {
  const id = document.getElementById('est-id').value;
  if(!id || !confirm('Excluir este produto?')) return;
  await sb.from('estoque').delete().eq('id', id);
  closeModal('modal-estoque');
  await estoqueCarregar();
}

function estoqueEntrada(id, nome) {
  document.getElementById('mov-id').value = id;
  document.getElementById('mov-tipo').value = 'entrada';
  document.getElementById('mov-titulo').textContent = '📥 Entrada de estoque';
  document.getElementById('mov-produto-nome').textContent = nome;
  document.getElementById('mov-qtd').value = '';
  document.getElementById('mov-obs').value = '';
  openModal('modal-estoque-mov');
}

function estoqueSaida(id, nome) {
  document.getElementById('mov-id').value = id;
  document.getElementById('mov-tipo').value = 'saida';
  document.getElementById('mov-titulo').textContent = '📤 Saída de estoque';
  document.getElementById('mov-produto-nome').textContent = nome;
  document.getElementById('mov-qtd').value = '';
  document.getElementById('mov-obs').value = '';
  openModal('modal-estoque-mov');
}

async function estoqueMovimentar() {
  const id = parseInt(document.getElementById('mov-id').value);
  const tipo = document.getElementById('mov-tipo').value;
  const qtd = parseInt(document.getElementById('mov-qtd').value)||0;
  if(!qtd) { alert('Informe a quantidade.'); return; }
  const item = EST.itens.find(i=>i.id===id);
  if(!item) return;
  const novaQtd = tipo==='entrada' ? (item.qtd_atual||0)+qtd : Math.max(0,(item.qtd_atual||0)-qtd);
  await sb.from('estoque').update({qtd_atual: novaQtd}).eq('id', id);
  closeModal('modal-estoque-mov');
  await estoqueCarregar();
}

// ══════════════════════════════════════════════
// METAS FINANCEIRAS
// ══════════════════════════════════════════════

async function metasCarregar() {
  const { data } = await sb.from('metas_financeiras').select('*').eq('user_id', S.user.id).order('mes', {ascending:false});
  METAS.lista = data || [];
  metasRender();
}

function metasRender() {
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const meta = METAS.lista.find(m => m.mes === mesAtual) || {};

  // Calcula valores reais do mês atual
  const mesStr = mesAtual + '-';
  const recAtual = (S.lancamentos||[]).filter(l=>l.tipo==='entrada'&&l.data?.startsWith(mesStr)).reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const despAtual = (S.lancamentos||[]).filter(l=>l.tipo==='saida'&&l.data?.startsWith(mesStr)).reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const lucroAtual = recAtual - despAtual;

  const setMeta = (atualId, alvoId, barId, pctId, atual, alvo) => {
    const el = document.getElementById(atualId); if(el) el.textContent = 'R$ '+atual.toFixed(2);
    const alvoEl = document.getElementById(alvoId); if(alvoEl) alvoEl.textContent = alvo ? 'R$ '+alvo.toFixed(2) : 'sem meta';
    const pct = alvo > 0 ? Math.min(100, (atual/alvo)*100) : 0;
    const bar = document.getElementById(barId); if(bar) bar.style.width = pct+'%';
    const pctEl = document.getElementById(pctId); if(pctEl) pctEl.textContent = pct.toFixed(0)+'%';
  };
  setMeta('meta-rec-atual','meta-rec-alvo','meta-rec-bar','meta-rec-pct', recAtual, meta.meta_receita||0);
  setMeta('meta-desp-atual','meta-desp-alvo','meta-desp-bar','meta-desp-pct', despAtual, meta.limite_despesas||0);
  setMeta('meta-lucro-atual','meta-lucro-alvo','meta-lucro-bar','meta-lucro-pct', lucroAtual, meta.meta_lucro||0);

  const lista = document.getElementById('metas-lista'); if(!lista) return;
  if(!METAS.lista.length) { lista.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px">Nenhuma meta cadastrada</div>'; return; }
  lista.innerHTML = METAS.lista.map(m => {
    const [ano, mes] = m.mes.split('-');
    const nomeMes = new Date(parseInt(ano), parseInt(mes)-1, 1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    return `<div class="card" style="display:grid;grid-template-columns:1fr repeat(3,auto);gap:16px;align-items:center">
      <div style="font-weight:700">${nomeMes}</div>
      <div style="text-align:center"><div style="font-size:11px;color:var(--muted)">Receita</div><div style="font-weight:700;color:var(--success)">${m.meta_receita?'R$ '+m.meta_receita.toFixed(2):'—'}</div></div>
      <div style="text-align:center"><div style="font-size:11px;color:var(--muted)">Despesas</div><div style="font-weight:700;color:var(--danger)">${m.limite_despesas?'R$ '+m.limite_despesas.toFixed(2):'—'}</div></div>
      <div style="text-align:center"><div style="font-size:11px;color:var(--muted)">Lucro</div><div style="font-weight:700;color:var(--accent2)">${m.meta_lucro?'R$ '+m.meta_lucro.toFixed(2):'—'}</div></div>
    </div>`;
  }).join('');
}

async function metaSalvar() {
  const mes = document.getElementById('meta-mes').value;
  if(!mes) { alert('Selecione o mês.'); return; }
  const payload = {
    user_id: S.user.id,
    mes,
    meta_receita: parseFloat(document.getElementById('meta-rec').value)||null,
    limite_despesas: parseFloat(document.getElementById('meta-desp').value)||null,
    meta_lucro: parseFloat(document.getElementById('meta-luc').value)||null
  };
  await sb.from('metas_financeiras').upsert(payload, {onConflict:'user_id,mes'});
  closeModal('modal-meta');
  await metasCarregar();
}

// ══════════════════════════════════════════════
// PREVISÃO DE CAIXA
// ══════════════════════════════════════════════
function previsaoRender(dias = 60) {
  ['30','60','90'].forEach(d => {
    const btn = document.getElementById('prev-btn-'+d);
    if(btn) { btn.className = d==String(dias) ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'; }
  });

  const hoje = new Date();
  const fmt = d => d.toISOString().slice(0,10);
  const limite = new Date(hoje); limite.setDate(hoje.getDate()+dias);

  // Saldo atual
  const ent = (S.lancamentos||[]).filter(l=>l.tipo==='entrada').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const sai = (S.lancamentos||[]).filter(l=>l.tipo==='saida').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  const saldoAtual = ent - sai;

  // Contas a receber abertas no período
  const receber = (S.contas_receber||[]).filter(r => r.status==='pendente' && r.vencimento >= fmt(hoje) && r.vencimento <= fmt(limite));
  const pagar = (S.contas_pagar||[]).filter(p => p.status==='pendente' && p.vencimento >= fmt(hoje) && p.vencimento <= fmt(limite));

  const totalReceber = receber.reduce((s,r)=>s+parseFloat(r.valor||0),0);
  const totalPagar = pagar.reduce((s,p)=>s+parseFloat(p.valor||0),0);
  const saldoProj = saldoAtual + totalReceber - totalPagar;

  const set = (id,v) => { const el=document.getElementById(id); if(el)el.textContent=v; };
  set('prev-saldo-hoje', 'R$ '+saldoAtual.toFixed(2));
  set('prev-entradas', 'R$ '+totalReceber.toFixed(2));
  set('prev-entradas-d', receber.length+' lançamentos previstos');
  set('prev-saidas', 'R$ '+totalPagar.toFixed(2));
  set('prev-saidas-d', pagar.length+' lançamentos previstos');
  set('prev-saldo-proj', 'R$ '+saldoProj.toFixed(2));
  const alertaEl = document.getElementById('prev-alerta');
  if(alertaEl) {
    alertaEl.textContent = saldoProj < 0 ? '⚠️ Caixa negativo projetado!' : saldoProj < saldoAtual*0.2 ? '⚠️ Reserva abaixo de 20%' : '✅ Fluxo positivo projetado';
    alertaEl.style.color = saldoProj < 0 ? 'var(--danger)' : saldoProj < saldoAtual*0.2 ? 'var(--fin)' : 'var(--success)';
  }

  // Gráfico de linha temporal
  const ctx = document.getElementById('chart-previsao'); if(!ctx) return;
  const labels = [], dataEntradas = [], dataSaidas = [], dataSaldo = [];
  let saldoAcc = saldoAtual;
  const semanas = Math.ceil(dias/7);
  for(let i=0; i<=semanas; i++) {
    const d = new Date(hoje); d.setDate(hoje.getDate()+i*7);
    if(d > limite) break;
    labels.push(d.getDate()+'/'+(d.getMonth()+1));
    const semFim = new Date(d); semFim.setDate(d.getDate()+7);
    const e = receber.filter(r=>r.vencimento>=fmt(d)&&r.vencimento<fmt(semFim)).reduce((s,r)=>s+parseFloat(r.valor||0),0);
    const s2 = pagar.filter(p=>p.vencimento>=fmt(d)&&p.vencimento<fmt(semFim)).reduce((s,p)=>s+parseFloat(p.valor||0),0);
    saldoAcc += e - s2;
    dataEntradas.push(e); dataSaidas.push(s2); dataSaldo.push(saldoAcc);
  }
  const K = '_ch_previsao'; if(window[K]) { try{window[K].destroy();}catch(e){} }
  window[K] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      {label:'Saldo projetado', data:dataSaldo, borderColor:'#06b6d4', backgroundColor:'rgba(6,182,212,.08)', fill:true, tension:.4, borderWidth:2},
      {label:'Entradas', data:dataEntradas, borderColor:'#10b981', borderDash:[4,4], borderWidth:1.5, tension:.3},
      {label:'Saídas', data:dataSaidas, borderColor:'#ef4444', borderDash:[4,4], borderWidth:1.5, tension:.3}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#8080a0',font:{size:11}}},tooltip:{backgroundColor:'#1a1a26',titleColor:'#f0f0f5',bodyColor:'#8080a0'}},
      scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#8080a0',font:{size:10}}},
        y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#8080a0',font:{size:10},callback:v=>'R$'+v},beginAtZero:false}}}
  });

  // Lista de eventos futuros
  const lista = document.getElementById('prev-lista'); if(!lista) return;
  const eventos = [
    ...receber.map(r=>({data:r.vencimento,tipo:'entrada',desc:r.descricao,cli:r.cliente,val:parseFloat(r.valor||0)})),
    ...pagar.map(p=>({data:p.vencimento,tipo:'saida',desc:p.descricao,cli:p.fornecedor,val:parseFloat(p.valor||0)}))
  ].sort((a,b)=>a.data.localeCompare(b.data)).slice(0,15);
  lista.innerHTML = eventos.length ? eventos.map(e=>`
    <div style="display:grid;grid-template-columns:90px 1fr auto auto;gap:12px;align-items:center;padding:8px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;border-left:3px solid ${e.tipo==='entrada'?'var(--success)':'var(--danger)'}">
      <div style="font-size:11px;color:var(--muted)">${e.data.split('-').reverse().join('/')}</div>
      <div><div style="font-size:13px;font-weight:600">${e.desc||'—'}</div><div style="font-size:11px;color:var(--muted)">${e.cli||''}</div></div>
      <span class="tag ${e.tipo==='entrada'?'entrada':'saida'}">${e.tipo==='entrada'?'Receber':'Pagar'}</span>
      <div style="font-weight:700;color:${e.tipo==='entrada'?'var(--success)':'var(--danger)'}">R$ ${e.val.toFixed(2)}</div>
    </div>`).join('') : '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px">Nenhum lançamento previsto no período</div>';
}

// ══════════════════════════════════════════════
// INADIMPLÊNCIA
// ══════════════════════════════════════════════
function inadimplenciaRender() {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const fmt = d => d.toISOString().slice(0,10);
  const atrasados = (S.contas_receber||[]).filter(r => r.status==='pendente' && r.vencimento < fmt(hoje));

  const grupos = { g7:{val:0,n:0}, g30:{val:0,n:0}, g60:{val:0,n:0}, g90:{val:0,n:0} };
  atrasados.forEach(r => {
    const venc = new Date(r.vencimento+'T12:00:00');
    const dias = Math.floor((hoje-venc)/(1000*60*60*24));
    const val = parseFloat(r.valor||0);
    if(dias <= 7) { grupos.g7.val+=val; grupos.g7.n++; }
    else if(dias <= 30) { grupos.g30.val+=val; grupos.g30.n++; }
    else if(dias <= 60) { grupos.g60.val+=val; grupos.g60.n++; }
    else { grupos.g90.val+=val; grupos.g90.n++; }
  });

  const set = (id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('aging-7','R$ '+grupos.g7.val.toFixed(2)); set('aging-7-n',grupos.g7.n+' clientes');
  set('aging-30','R$ '+grupos.g30.val.toFixed(2)); set('aging-30-n',grupos.g30.n+' clientes');
  set('aging-60','R$ '+grupos.g60.val.toFixed(2)); set('aging-60-n',grupos.g60.n+' clientes');
  set('aging-90','R$ '+grupos.g90.val.toFixed(2)); set('aging-90-n',grupos.g90.n+' clientes');

  const tb = document.getElementById('tb-inadimplencia'); if(!tb) return;
  if(!atrasados.length) { tb.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--success);padding:24px">🎉 Nenhum atraso! Inadimplência zero.</td></tr>'; return; }
  tb.innerHTML = atrasados.sort((a,b)=>a.vencimento.localeCompare(b.vencimento)).map(r => {
    const venc = new Date(r.vencimento+'T12:00:00');
    const dias = Math.floor((hoje-venc)/(1000*60*60*24));
    const cor = dias<=7?'var(--fin)':dias<=30?'#fb923c':dias<=60?'var(--danger)':'#7f1d1d';
    const label = dias<=7?'1-7d':dias<=30?'8-30d':dias<=60?'31-60d':'60d+';
    return `<tr>
      <td style="font-weight:600">${r.cliente||'—'}</td>
      <td>${r.descricao||'—'}</td>
      <td>${r.vencimento?.split('-').reverse().join('/')||'—'}</td>
      <td style="font-weight:700;color:${cor}">${dias}d</td>
      <td style="font-weight:700;color:var(--danger)">R$ ${parseFloat(r.valor||0).toFixed(2)}</td>
      <td><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${cor}22;color:${cor}">${label}</span></td>
      <td><button class="btn btn-success btn-sm" onclick="receberConta(${r.id})">✓ Recebido</button></td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════
// CRM
// ══════════════════════════════════════════════

async function crmCarregar() {
  const { data } = await sb.from('crm_leads').select('*').eq('user_id', S.user.id).order('created_at', {ascending:false});
  CRM.leads = data || [];
  crmKPIs();
  crmRender();
}

function crmKPIs() {
  const set = (id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('crm-total', CRM.leads.length);
  set('crm-negoc', CRM.leads.filter(l=>['contato','proposta','negociacao'].includes(l.estagio)).length);
  set('crm-fechado', CRM.leads.filter(l=>l.estagio==='fechado').length);
  set('crm-perdido', CRM.leads.filter(l=>l.estagio==='perdido').length);
  const receita = CRM.leads.filter(l=>l.estagio!=='perdido').reduce((s,l)=>s+parseFloat(l.valor||0),0);
  set('crm-receita', receita>0?'R$ '+receita.toFixed(2):'—');
}

function crmSetView(view, btn) {
  CRM.view = view;
  document.querySelectorAll('[id^=crm-view-]').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.getElementById('crm-kanban').style.display = view==='kanban'?'grid':'none';
  document.getElementById('crm-lista-view').style.display = view==='lista'?'block':'none';
  crmRender();
}

function crmRender() {
  const busca = document.getElementById('crm-busca')?.value.toLowerCase()||'';
  const fonte = document.getElementById('crm-fonte-filtro')?.value||'';
  let leads = CRM.leads.filter(l =>
    (!busca || l.nome?.toLowerCase().includes(busca) || l.empresa?.toLowerCase().includes(busca)) &&
    (!fonte || l.fonte === fonte)
  );

  if(CRM.view === 'kanban') {
    const kanban = document.getElementById('crm-kanban'); if(!kanban) return;
    kanban.innerHTML = CRM.estagios.map(est => {
      const cards = leads.filter(l=>l.estagio===est.id);
      const total = cards.reduce((s,l)=>s+parseFloat(l.valor||0),0);
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;min-width:180px">
        <div style="padding:10px 12px;background:${est.cor}18;border-bottom:2px solid ${est.cor};display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:12px;font-weight:700">${est.label}</span>
          <span style="font-size:10px;background:${est.cor}30;color:${est.cor};padding:2px 6px;border-radius:10px;font-weight:700">${cards.length}</span>
        </div>
        ${total>0?`<div style="padding:4px 12px;font-size:10px;color:var(--muted);border-bottom:1px solid var(--border)">R$ ${total.toFixed(2)}</div>`:''}
        <div style="padding:8px;display:flex;flex-direction:column;gap:6px;min-height:80px">
          ${cards.map(l=>`
            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;transition:all .15s;position:relative" onmouseover="this.querySelector('.card-actions').style.opacity='1'" onmouseout="this.querySelector('.card-actions').style.opacity='0'">
              <div onclick="leadEditar(${l.id})" style="cursor:pointer">
                <div style="font-size:12px;font-weight:700;margin-bottom:2px">${l.nome||'—'}</div>
                ${l.empresa?`<div style="font-size:10px;color:var(--muted)">${l.empresa}</div>`:''}
                <div style="display:flex;justify-content:space-between;margin-top:4px;align-items:center">
                  <span style="font-size:9px;padding:1px 5px;border-radius:5px;background:rgba(99,102,241,.15);color:#a78bfa">${l.fonte||'—'}</span>
                  ${l.valor>0?`<span style="font-size:10px;font-weight:700;color:var(--success)">R$${parseFloat(l.valor).toFixed(0)}</span>`:''}
                </div>
                ${l.proximo_contato?`<div style="font-size:9px;color:var(--fin);margin-top:3px">📅 ${l.proximo_contato.split('-').reverse().join('/')}</div>`:''}
              </div>
              <div class="card-actions" style="opacity:0;transition:opacity .15s;display:flex;gap:3px;margin-top:5px;border-top:1px solid var(--border);padding-top:5px">
                <button onclick="leadEditar(${l.id})" style="flex:1;padding:3px;background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.3);border-radius:4px;color:#60a5fa;font-size:10px;cursor:pointer">✏️ Editar</button>
                <button onclick="leadMover(${l.id},'${est.id}')" style="flex:1;padding:3px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:4px;color:#34d399;font-size:10px;cursor:pointer">↔ Mover</button>
                <button onclick="leadDeletar(${l.id})" style="padding:3px 6px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:4px;color:var(--danger);font-size:10px;cursor:pointer">🗑</button>
              </div>
            </div>`).join('')}
        </div>
        <div style="padding:6px 8px;border-top:1px solid var(--border)">
          <button onclick="leadNovo('${est.id}')" style="width:100%;padding:5px;background:${est.cor}15;border:1px dashed ${est.cor}50;border-radius:6px;color:${est.cor};font-size:11px;cursor:pointer;font-family:inherit">+ Adicionar</button>
        </div>
      </div>`;
    }).join('');
  } else {
    const tb = document.getElementById('tb-crm'); if(!tb) return;
    if(!leads.length) { tb.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Nenhum lead encontrado</td></tr>'; return; }
    const estMap = Object.fromEntries(CRM.estagios.map(e=>[e.id,e]));
    tb.innerHTML = leads.map(l=>{
      const est = estMap[l.estagio]||{label:l.estagio,cor:'var(--muted)'};
      return `<tr>
        <td style="font-weight:600">${l.nome||'—'}</td>
        <td style="color:var(--muted)">${l.empresa||'—'}</td>
        <td><span style="padding:2px 7px;border-radius:10px;font-size:10px;background:rgba(99,102,241,.15);color:#a78bfa">${l.fonte||'—'}</span></td>
        <td><span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:${est.cor}20;color:${est.cor}">${est.label}</span></td>
        <td style="font-weight:600;color:var(--success)">${l.valor?'R$ '+parseFloat(l.valor).toFixed(2):'—'}</td>
        <td style="color:var(--muted)">${l.responsavel||'—'}</td>
        <td style="color:var(--fin)">${l.proximo_contato?.split('-').reverse().join('/')||'—'}</td>
        <td style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="leadEditar(${l.id})">✏️</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="leadDeletar(${l.id})">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }
}

function leadNovo(estagio='novo') {
  document.getElementById('lead-id').value='';
  document.getElementById('lead-modal-titulo').textContent='👤 Novo Lead';
  document.getElementById('lead-nome').value='';
  document.getElementById('lead-empresa').value='';
  document.getElementById('lead-wpp').value='';
  document.getElementById('lead-email').value='';
  document.getElementById('lead-fonte').value='instagram';
  document.getElementById('lead-estagio').value=estagio;
  document.getElementById('lead-valor').value='';
  document.getElementById('lead-resp').value='';
  document.getElementById('lead-prox').value='';
  document.getElementById('lead-obs').value='';
  document.getElementById('lead-del-btn').style.display='none';
  openModal('modal-lead');
}

function leadEditar(id) {
  const l = CRM.leads.find(x=>x.id===id); if(!l) return;
  document.getElementById('lead-id').value=l.id;
  document.getElementById('lead-modal-titulo').textContent='✏️ Editar Lead';
  document.getElementById('lead-nome').value=l.nome||'';
  document.getElementById('lead-empresa').value=l.empresa||'';
  document.getElementById('lead-wpp').value=l.whatsapp||'';
  document.getElementById('lead-email').value=l.email||'';
  document.getElementById('lead-fonte').value=l.fonte||'outro';
  document.getElementById('lead-estagio').value=l.estagio||'novo';
  document.getElementById('lead-valor').value=l.valor||'';
  document.getElementById('lead-resp').value=l.responsavel||'';
  document.getElementById('lead-prox').value=l.proximo_contato||'';
  document.getElementById('lead-obs').value=l.observacoes||'';
  document.getElementById('lead-del-btn').style.display='inline-flex';
  openModal('modal-lead');
}

async function leadSalvar() {
  const id = document.getElementById('lead-id').value;
  const nome = document.getElementById('lead-nome').value.trim();
  if(!nome) { alert('Informe o nome do lead.'); return; }
  const payload = {
    user_id: S.user.id,
    nome,
    empresa: document.getElementById('lead-empresa').value.trim(),
    whatsapp: document.getElementById('lead-wpp').value.trim(),
    email: document.getElementById('lead-email').value.trim(),
    fonte: document.getElementById('lead-fonte').value,
    estagio: document.getElementById('lead-estagio').value,
    valor: parseFloat(document.getElementById('lead-valor').value)||null,
    responsavel: document.getElementById('lead-resp').value.trim(),
    proximo_contato: document.getElementById('lead-prox').value||null,
    observacoes: document.getElementById('lead-obs').value.trim()
  };
  try {
    let res;
    if(id) { res = await sb.from('crm_leads').update(payload).eq('id', id); }
    else { res = await sb.from('crm_leads').insert(payload); }
    if(res.error) { alert('Erro ao salvar lead: ' + res.error.message); return; }
    closeModal('modal-lead');
    await crmCarregar();
  } catch(e) { alert('Erro: '+e.message); }
}

async function leadExcluir() {
  const id = document.getElementById('lead-id').value;
  if(!id || !confirm('Excluir este lead?')) return;
  await sb.from('crm_leads').delete().eq('id', id);
  closeModal('modal-lead');
  await crmCarregar();
}

async function leadDeletar(id) {
  if(!confirm('Excluir este lead permanentemente?')) return;
  await sb.from('crm_leads').delete().eq('id', id);
  CRM.leads = CRM.leads.filter(l => l.id !== id);
  crmRender();
}

function leadMover(id, estagioAtual) {
  const estagios = CRM.estagios.filter(e => e.id !== estagioAtual);
  const opcoes = estagios.map(e => `<option value="${e.id}">${e.label}</option>`).join('');
  const sel = prompt(`Mover lead para qual estágio?\n${estagios.map(e=>e.label).join(', ')}`);
  if(!sel) return;
  const match = CRM.estagios.find(e => e.label.toLowerCase().includes(sel.toLowerCase()) || e.id === sel);
  if(match) {
    sb.from('crm_leads').update({estagio: match.id}).eq('id', id).then(()=>{
      const lead = CRM.leads.find(l=>l.id===id);
      if(lead) lead.estagio = match.id;
      crmRender();
    });
  } else {
    alert('Estágio não encontrado. Use: Novo lead, Em contato, Proposta, Negociação, Fechado ou Perdido');
  }
}

// ── Atualiza showFinTab para incluir novas abas ──
// ══════════════════════════════════════════════
// CLIENTES — Financeiro
// ══════════════════════════════════════════════
let CLIENTES = [];

async function clientesCarregar() {
  try {
    const { data } = await sb.from('clientes').select('*').eq('user_id', S.user.id).order('nome');
    CLIENTES = data || [];
    clientesRender();
    clientesMetricas();
  } catch(e) {
    // Tabela pode não existir ainda — renderiza vazia
    clientesRender();
  }
}

function clientesRender() {
  const tb = document.getElementById('tb-clientes');
  if(!tb) return;
  if(!CLIENTES.length) { tb.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Nenhum cliente cadastrado</td></tr>'; return; }
  const statusCor = { ativo:'var(--success)', inadimplente:'var(--danger)', pausado:'var(--fin)', encerrado:'var(--muted)' };
  tb.innerHTML = CLIENTES.map(c => `<tr>
    <td style="font-weight:600">${c.nome}</td>
    <td style="color:var(--muted)">${c.empresa||'—'}</td>
    <td style="color:var(--muted)">${c.whatsapp||c.email||'—'}</td>
    <td>${c.servico||'—'}</td>
    <td style="font-weight:600;color:var(--success)">${c.valor_mensal?fmt(c.valor_mensal):'—'}</td>
    <td style="color:var(--muted)">${c.dia_vencimento?'Dia '+c.dia_vencimento:'—'}</td>
    <td><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${statusCor[c.status]||'var(--muted)'}20;color:${statusCor[c.status]||'var(--muted)'};font-weight:600">${c.status||'ativo'}</span></td>
    <td style="display:flex;gap:4px">
      <button class="btn btn-ghost btn-sm" style="padding:2px 6px" onclick="clienteEditar('${c.id}')">✏️</button>
      <button class="btn btn-ghost btn-sm" style="padding:2px 6px;color:var(--danger)" onclick="clienteDeletarId('${c.id}')">🗑</button>
    </td>
  </tr>`).join('');
}

function clientesMetricas() {
  const ativos = CLIENTES.filter(c => c.status === 'ativo');
  const receita = ativos.reduce((s,c) => s + parseFloat(c.valor_mensal||0), 0);
  const ticket = ativos.length ? receita / ativos.length : 0;
  const inadimp = CLIENTES.filter(c => c.status === 'inadimplente').length;
  const el = id => document.getElementById(id);
  if(el('cli-total')) el('cli-total').textContent = CLIENTES.length;
  if(el('cli-receita')) el('cli-receita').textContent = fmt(receita);
  if(el('cli-ticket')) el('cli-ticket').textContent = fmt(ticket);
  if(el('cli-inadimp')) el('cli-inadimp').textContent = inadimp;
}

async function clienteSalvar() {
  const id = document.getElementById('cli-id').value;
  const nome = document.getElementById('cli-nome').value.trim();
  if(!nome) { alert('Nome é obrigatório.'); return; }
  const payload = {
    user_id: S.user.id,
    nome,
    empresa: document.getElementById('cli-empresa').value.trim(),
    whatsapp: document.getElementById('cli-wpp').value.trim(),
    email: document.getElementById('cli-email').value.trim(),
    servico: document.getElementById('cli-servico').value.trim(),
    valor_mensal: parseFloat(document.getElementById('cli-valor').value)||0,
    dia_vencimento: parseInt(document.getElementById('cli-vencimento').value)||null,
    status: document.getElementById('cli-status').value,
    observacoes: document.getElementById('cli-obs').value.trim()
  };
  try {
    if(id) {
      await sb.from('clientes').update(payload).eq('id', id);
      const idx = CLIENTES.findIndex(c=>c.id===id);
      if(idx>=0) CLIENTES[idx] = {...CLIENTES[idx], ...payload};
    } else {
      const { data } = await sb.from('clientes').insert(payload).select().limit(1);
      if(data && data[0]) CLIENTES.push(data[0]);
    }
    clientesRender(); clientesMetricas();
    closeModal('modal-cliente');
  } catch(e) { alert('Erro ao salvar: ' + e.message); }
}

function clienteEditar(id) {
  const c = CLIENTES.find(x => x.id === id); if(!c) return;
  document.getElementById('cli-id').value = c.id;
  document.getElementById('cli-modal-titulo').textContent = '✏️ Editar Cliente';
  document.getElementById('cli-nome').value = c.nome||'';
  document.getElementById('cli-empresa').value = c.empresa||'';
  document.getElementById('cli-wpp').value = c.whatsapp||'';
  document.getElementById('cli-email').value = c.email||'';
  document.getElementById('cli-servico').value = c.servico||'';
  document.getElementById('cli-valor').value = c.valor_mensal||'';
  document.getElementById('cli-vencimento').value = c.dia_vencimento||'';
  document.getElementById('cli-status').value = c.status||'ativo';
  document.getElementById('cli-obs').value = c.observacoes||'';
  document.getElementById('cli-del-btn').style.display = 'inline-flex';
  openModal('modal-cliente');
}

function clienteNovo() {
  document.getElementById('cli-id').value = '';
  document.getElementById('cli-modal-titulo').textContent = '👤 Novo Cliente';
  ['cli-nome','cli-empresa','cli-wpp','cli-email','cli-servico','cli-valor','cli-vencimento','cli-obs'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
  document.getElementById('cli-status').value = 'ativo';
  document.getElementById('cli-del-btn').style.display = 'none';
  openModal('modal-cliente');
}

async function clienteDeletarId(id) {
  if(!confirm('Excluir este cliente?')) return;
  await sb.from('clientes').delete().eq('id', id);
  CLIENTES = CLIENTES.filter(c => c.id !== id);
  clientesRender(); clientesMetricas();
}

async function clienteDeletar() {
  const id = document.getElementById('cli-id').value;
  if(!id) return;
  await clienteDeletarId(id);
  closeModal('modal-cliente');
}

function showFinTab(tab, btn) {
  S.finTab=tab;
  requestAnimationFrame(()=>{document.body.scrollTop=0;document.documentElement.scrollTop=0;window.scrollTo({top:0,behavior:'instant'});const _m=document.querySelector('.main');if(_m)_m.scrollTop=0;});
  ['dashboard','lancamentos','clientes','pagar','receber','notas','fluxo','dre','agente-fin','metas','previsao','inadimplencia','estoque'].forEach(t=>{
    const el=document.getElementById('fin-'+t);
    if(el)el.style.display=t===tab?'block':'none';
  });
  document.querySelectorAll('[id^=ftab-]').forEach(b=>{b.className='btn btn-ghost btn-sm';});
  const active=document.getElementById('ftab-'+tab);
  if(active)active.className='btn btn-primary btn-sm';
  if(tab==='dashboard')setTimeout(renderDashFin,100);
  if(tab==='clientes')clientesCarregar();
  if(tab==='fluxo')renderCharts();
  if(tab==='dre')renderDRE();
  if(tab==='agente-fin'&&document.getElementById('chat-fin').innerHTML==='')initFinChat();
  if(tab==='metas')metasRender();
  if(tab==='previsao')previsaoRender(60);
  if(tab==='inadimplencia')inadimplenciaRender();
  if(tab==='estoque')estoqueCarregar();
}

// ── SQL das novas tabelas (acessível via console) ──
function showNewTablesSQL() {
  return `-- Execute no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS estoque (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, sku TEXT, categoria TEXT DEFAULT 'produto',
  qtd_atual INTEGER DEFAULT 0, qtd_minima INTEGER DEFAULT 0,
  custo_unit NUMERIC(10,2) DEFAULT 0, preco_venda NUMERIC(10,2) DEFAULT 0,
  fornecedor TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "estoque_user" ON estoque FOR ALL USING (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS metas_financeiras (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mes TEXT NOT NULL, -- formato YYYY-MM
  meta_receita NUMERIC(12,2), limite_despesas NUMERIC(12,2), meta_lucro NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, mes)
);
ALTER TABLE metas_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "metas_user" ON metas_financeiras FOR ALL USING (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS crm_leads (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, empresa TEXT, whatsapp TEXT, email TEXT,
  fonte TEXT DEFAULT 'outro',
  estagio TEXT DEFAULT 'novo', -- novo, contato, proposta, negociacao, fechado, perdido
  valor NUMERIC(12,2), responsavel TEXT, proximo_contato DATE,
  observacoes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "crm_user" ON crm_leads FOR ALL USING (auth.uid()=user_id);`;
}
document.getElementById('p-venc').valueAsDate=new Date();
document.getElementById('r-venc').valueAsDate=new Date();
document.getElementById('ag-data').valueAsDate=new Date();
// Init ads date range
(function(){
  var adsTo = new Date(); var adsFrom = new Date(); adsFrom.setFullYear(adsTo.getFullYear()-1);
  var dfEl=document.getElementById('ads-date-from'); if(dfEl)dfEl.value=adsFrom.toISOString().slice(0,10);
  var dtEl=document.getElementById('ads-date-to');   if(dtEl)dtEl.value=adsTo.toISOString().slice(0,10);
})();

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&S.user)document.getElementById('loading').style.display='none';});
window.addEventListener('pageshow',(e)=>{if(e.persisted&&S.user){document.getElementById('loading').style.display='none';document.getElementById('app-screen').classList.add('visible');document.getElementById('auth-screen').style.display='none';}});

// ══════════════════════════════════════════════
// WHATSAPP HUB
// ══════════════════════════════════════════════

const WA = { config: null, leads: [], conversas: [] };

function waTab(tab, btn) {
  ['visao','agente','leads','campanhas','notif','config'].forEach(t => {
    const el = document.getElementById('wa-panel-'+t);
    if(el) el.style.display = t===tab ? 'block' : 'none';
  });
  document.querySelectorAll('[id^=watab-]').forEach(b => b.className='btn btn-ghost btn-sm');
  const active = document.getElementById('watab-'+tab);
  if(active) active.className = 'btn btn-primary btn-sm';
  if(tab==='visao') waCarregarVisao();
  if(tab==='leads') waCarregarLeads();
}

async function waCarregarConfig() {
  try {
    const { data } = await sb.from('matriz_empresa').select('wa_phone_id,wa_waba_id,wa_token,wa_numero,wa_agent_nome,wa_agent_tom,wa_agent_boas_vindas,wa_agent_escalar,wa_notif_numero').eq('user_id', S.user.id).single();
    if(data) {
      WA.config = data;
      if(data.wa_phone_id) {
        document.getElementById('wa-phone-id').value = data.wa_phone_id;
        document.getElementById('wa-phone-id-display').textContent = data.wa_phone_id.slice(0,8)+'...';
      }
      if(data.wa_waba_id) {
        document.getElementById('wa-waba-id').value = data.wa_waba_id;
        document.getElementById('wa-waba-display').textContent = data.wa_waba_id.slice(0,8)+'...';
      }
      if(data.wa_token) document.getElementById('wa-token').value = data.wa_token;
      if(data.wa_numero) {
        document.getElementById('wa-numero').value = data.wa_numero;
        document.getElementById('wa-numero-display').textContent = data.wa_numero;
      }
      if(data.wa_agent_nome) document.getElementById('wa-agent-nome').value = data.wa_agent_nome;
      if(data.wa_agent_tom) document.getElementById('wa-agent-tom').value = data.wa_agent_tom;
      if(data.wa_agent_boas_vindas) document.getElementById('wa-agent-boas-vindas').value = data.wa_agent_boas_vindas;
      if(data.wa_agent_escalar) document.getElementById('wa-agent-escalar').value = data.wa_agent_escalar;
      if(data.wa_notif_numero) document.getElementById('wa-notif-numero').value = data.wa_notif_numero;
      if(data.wa_phone_id && data.wa_token) {
        document.getElementById('wa-conn-status').textContent = '● Conectado';
        document.getElementById('wa-conn-status').style.background = 'rgba(16,185,129,0.15)';
        document.getElementById('wa-conn-status').style.color = 'var(--success)';
        document.getElementById('wa-conn-status').style.borderColor = 'rgba(16,185,129,0.3)';
      }
    }
  } catch(e) {}
}

async function waSalvarConfig() {
  const phoneId = document.getElementById('wa-phone-id').value.trim();
  const wabaId = document.getElementById('wa-waba-id').value.trim();
  const token = document.getElementById('wa-token').value.trim();
  const numero = document.getElementById('wa-numero').value.trim();
  if(!phoneId || !token) { alert('Preencha pelo menos o Phone Number ID e o Token.'); return; }
  try {
    await sb.from('matriz_empresa').upsert({ user_id: S.user.id, wa_phone_id: phoneId, wa_waba_id: wabaId, wa_token: token, wa_numero: numero }, { onConflict: 'user_id' });
    const msg = document.getElementById('wa-config-msg');
    msg.textContent = '✅ Configuração salva com sucesso!';
    msg.style.color = 'var(--success)';
    await waCarregarConfig();
    setTimeout(() => msg.textContent = '', 3000);
  } catch(e) { alert('Erro ao salvar: '+e.message); }
}

async function waTestarConexao() {
  const phoneId = document.getElementById('wa-phone-id').value.trim();
  const token = document.getElementById('wa-token').value.trim();
  if(!phoneId || !token) { alert('Preencha o Phone Number ID e o Token primeiro.'); return; }
  const msg = document.getElementById('wa-config-msg');
  msg.textContent = '⏳ Testando conexão...';
  msg.style.color = 'var(--muted)';
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}?access_token=${token}`);
    const data = await res.json();
    if(data.id) {
      msg.textContent = `✅ Conectado! Número: ${data.display_phone_number || data.id}`;
      msg.style.color = 'var(--success)';
    } else {
      msg.textContent = '❌ Erro: '+( data.error?.message || 'Token inválido');
      msg.style.color = 'var(--danger)';
    }
  } catch(e) {
    msg.textContent = '❌ Erro de conexão: '+e.message;
    msg.style.color = 'var(--danger)';
  }
}

async function waSalvarAgente() {
  try {
    await sb.from('matriz_empresa').upsert({
      user_id: S.user.id,
      wa_agent_nome: document.getElementById('wa-agent-nome').value,
      wa_agent_tom: document.getElementById('wa-agent-tom').value,
      wa_agent_boas_vindas: document.getElementById('wa-agent-boas-vindas').value,
      wa_agent_escalar: document.getElementById('wa-agent-escalar').value
    }, { onConflict: 'user_id' });
    alert('✅ Agente configurado!');
  } catch(e) { alert('Erro: '+e.message); }
}

function waAgenteToggle() {
  const ativo = document.getElementById('wa-agent-ativo').checked;
  const span = document.getElementById('wa-toggle-span');
  span.style.background = ativo ? '#25d366' : 'rgba(255,255,255,0.1)';
}

async function waGerarMensagemIA() {
  const prompt = document.getElementById('wa-camp-ia-prompt').value.trim();
  if(!prompt) return;
  const contexto = matrizParaContexto();
  const res = await fetch(EDGE, { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_ANON,'apikey':SB_ANON},
    body: JSON.stringify({
      messages:[{role:'user', content:`Crie uma mensagem de WhatsApp para campanha de marketing. Objetivo: ${prompt}. Use {nome} para personalizar. Máximo 3 parágrafos curtos, tom conversacional, inclua CTA claro. Contexto do negócio:\n${contexto}`}],
      systemPrompt: 'Você é especialista em copywriting para WhatsApp. Crie mensagens curtas, pessoais e com alto engajamento. Retorne apenas a mensagem, sem explicações.'
    })
  });
  const data = await res.json();
  if(data.reply) document.getElementById('wa-camp-msg').value = data.reply;
}

function waPreviewCampanha() {
  const msg = document.getElementById('wa-camp-msg').value;
  const preview = msg.replace('{nome}', 'João Silva');
  alert('📱 Preview:\n\n' + preview);
}

async function waEnviarCampanha() {
  const nome = document.getElementById('wa-camp-nome').value.trim();
  const msg = document.getElementById('wa-camp-msg').value.trim();
  if(!nome || !msg) { alert('Preencha o nome e a mensagem da campanha.'); return; }
  if(!WA.config?.wa_phone_id) { alert('Configure a integração WhatsApp primeiro (aba Config).'); return; }
  if(!confirm(`Enviar campanha "${nome}" para o público selecionado?`)) return;
  alert('🚀 Campanha em fila para envio!\n\nIntegração com Meta Business API em produção — os envios serão processados respeitando os limites da API do WhatsApp Business.');
}

function waSyncLeads() {
  alert('🔄 Sincronizando leads do WhatsApp com o CRM...\n\nTodos os contatos identificados nas conversas serão adicionados como leads no CRM de Marketing.');
}

async function waSalvarQualificacao() {
  try {
    await sb.from('matriz_empresa').upsert({
      user_id: S.user.id,
      wa_qual_1: document.getElementById('wa-qual-1').value,
      wa_qual_2: document.getElementById('wa-qual-2').value,
      wa_qual_min: parseFloat(document.getElementById('wa-qual-min').value)||0,
      wa_qual_acao: document.getElementById('wa-qual-acao').value
    }, { onConflict: 'user_id' });
    alert('✅ Regras de qualificação salvas!');
  } catch(e) { alert('Erro: '+e.message); }
}

async function waSalvarNotificacoes() {
  const numero = document.getElementById('wa-notif-numero').value.trim();
  if(!numero) { alert('Informe o número para receber notificações.'); return; }
  try {
    await sb.from('matriz_empresa').upsert({ user_id: S.user.id, wa_notif_numero: numero }, { onConflict: 'user_id' });
    alert('✅ Notificações configuradas! Você receberá alertas no '+numero);
  } catch(e) { alert('Erro: '+e.message); }
}

function waCarregarVisao() {
  // Métricas placeholder — serão populadas via webhook
  document.getElementById('wa-msgs-hoje').textContent = '0';
  document.getElementById('wa-leads-total').textContent = '0';
  document.getElementById('wa-atendidos').textContent = '0';
  document.getElementById('wa-taxa').textContent = '—';
}

function waCarregarLeads() {
  // Busca leads do CRM com origem whatsapp
  sb.from('crm_leads').select('*').eq('user_id', S.user.id).eq('fonte', 'whatsapp').order('created_at', {ascending:false}).then(({data}) => {
    const tbody = document.getElementById('wa-leads-tbody');
    if(!data?.length) { tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Nenhum lead via WhatsApp ainda</td></tr>'; return; }
    tbody.innerHTML = data.map(l => `
      <tr>
        <td>${l.nome}</td>
        <td>${l.whatsapp||'—'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.observacoes||'—'}</td>
        <td><span class="tag ${l.estagio==='novo'?'pendente':'entrada'}">${l.estagio}</span></td>
        <td><span class="tag pendente">WA</span></td>
        <td><button class="btn btn-ghost btn-sm" onclick="nav('mkt',document.querySelectorAll('.nav-item')[2]);setTimeout(()=>mktTab('crm',document.getElementById('mktab-crm')),200)">Ver no CRM</button></td>
      </tr>`).join('');
  });
}


// ══ NEURAL NETWORK CANVAS ══
function initNeuralCanvas(){var c=document.getElementById('neural-canvas');if(!c||c.dataset.ok)return;c.dataset.ok='1';var ctx=c.getContext('2d');var dpr=window.devicePixelRatio||1;c.width=c.offsetWidth*dpr;c.height=c.offsetHeight*dpr;ctx.scale(dpr,dpr);var W=c.offsetWidth,H=c.offsetHeight;var BLUE='#1b1b21',BLACK='#0c0c0e',GRAY='#dddde0',TEXT='#1b1b21',MUTED='#8f8f9c';var nodes=[{id:'p1',lb:'Propósito',x:W*.08,y:H*.26,r:24},{id:'p2',lb:'Produto',x:W*.27,y:H*.12,r:24},{id:'p3',lb:'Pessoas',x:W*.46,y:H*.26,r:24},{id:'p4',lb:'Processo',x:W*.65,y:H*.12,r:24},{id:'p5',lb:'Posicionamento',x:W*.84,y:H*.26,r:24},{id:'mc',lb:'Matriz Central',x:W*.46,y:H*.52,r:20,hub:1},{id:'p6',lb:'Performance',x:W*.46,y:H*.80,r:28,pf:1}];var edges=[['p1','p2'],['p2','p3'],['p3','p4'],['p4','p5'],['p1','mc'],['p2','mc'],['p3','mc'],['p4','mc'],['p5','mc'],['mc','p6']];var parts=[];edges.forEach(function(_,i){for(var j=0;j<2;j++)parts.push({e:i,p:Math.random(),s:.001+Math.random()*.002,sz:1.5+Math.random()*1});});c.addEventListener('click',function(evt){var rect=c.getBoundingClientRect();var mx=evt.clientX-rect.left,my=evt.clientY-rect.top;for(var i=0;i<nodes.length;i++){var n=nodes[i];if(n.hub)continue;var dx=mx-n.x,dy=my-n.y;if(dx*dx+dy*dy<(n.r+12)*(n.r+12)){abrirPopupP(n.id);return;}}});c.addEventListener('mousemove',function(evt){var rect=c.getBoundingClientRect();var mx=evt.clientX-rect.left,my=evt.clientY-rect.top;var hit=false;for(var i=0;i<nodes.length;i++){var n=nodes[i];if(n.hub)continue;var dx=mx-n.x,dy=my-n.y;if(dx*dx+dy*dy<(n.r+12)*(n.r+12)){hit=true;break;}}c.style.cursor=hit?'pointer':'default';});var t=0;function draw(){ctx.clearRect(0,0,W,H);t+=.006;edges.forEach(function(e){var a,b;for(var i=0;i<nodes.length;i++){if(nodes[i].id===e[0])a=nodes[i];if(nodes[i].id===e[1])b=nodes[i];}ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=GRAY;ctx.lineWidth=.5;ctx.stroke();});parts.forEach(function(p){p.p+=p.s;if(p.p>1)p.p=0;var e=edges[p.e];var a,b;for(var i=0;i<nodes.length;i++){if(nodes[i].id===e[0])a=nodes[i];if(nodes[i].id===e[1])b=nodes[i];}var px=a.x+(b.x-a.x)*p.p,py=a.y+(b.y-a.y)*p.p;ctx.beginPath();ctx.arc(px,py,p.sz,0,Math.PI*2);ctx.fillStyle=BLUE;ctx.globalAlpha=.4+Math.sin(t*3+p.p*6)*.3;ctx.fill();ctx.globalAlpha=1;});nodes.forEach(function(n,i){var pulse=n.hub?1+Math.sin(t*1.2)*.04:1+Math.sin(t*1.8+i)*.02;var r=n.r*pulse;ctx.beginPath();ctx.arc(n.x,n.y,r+8,0,Math.PI*2);ctx.fillStyle=BLUE;ctx.globalAlpha=.04+Math.sin(t*1.2+i)*.015;ctx.fill();ctx.globalAlpha=1;ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);var st=SP.progresso?SP.progresso[n.id+'_status']:'';if(n.hub)ctx.fillStyle=BLACK;else if(st==='concluido')ctx.fillStyle=BLUE;else ctx.fillStyle='#dddde0';ctx.fill();if(n.hub){ctx.beginPath();ctx.arc(n.x,n.y,r+1,0,Math.PI*2);ctx.strokeStyle=BLUE;ctx.lineWidth=1;ctx.globalAlpha=.5;ctx.stroke();ctx.globalAlpha=1;}ctx.fillStyle='#fff';ctx.font='600 10px "Plus Jakarta Sans",system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n.hub?'◆':n.id.toUpperCase(),n.x,n.y);ctx.fillStyle=TEXT;ctx.font='500 11px "Plus Jakarta Sans",system-ui';ctx.fillText(n.lb,n.x,n.y+r+18);if(!n.hub&&!n.pf&&st==='concluido'){ctx.fillStyle=BLUE;ctx.font='400 9px "Plus Jakarta Sans",system-ui';ctx.fillText('concluído',n.x,n.y+r+30);}if(n.pf){ctx.fillStyle=MUTED;ctx.font='400 9px "Plus Jakarta Sans",system-ui';ctx.fillText('OKRs · KPIs · Metas',n.x,n.y+r+30);}});requestAnimationFrame(draw);}draw();}

init();
