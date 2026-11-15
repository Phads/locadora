const SV=[{id:1,n:"Barba",d:30,p:30},{id:2,n:"Corte + barba",d:60,p:55},{id:3,n:"Corte + barba + sobrancelha",d:60,p:55},{id:4,n:"Botox",d:120,p:90}];
const $=s=>document.querySelector(s),pad=n=>String(n).padStart(2,"0"),hm=m=>pad(Math.floor(m/60))+":"+pad(m%60),R=v=>"R$ "+v.toFixed(2).replace(".",",");
const esc=s=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ls={g(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}},s(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let db={c:ls.g("hn_c",[]),me:ls.g("hn_m",null),a:ls.g("hn_a",[])};
const save=()=>{ls.s("hn_c",db.c);ls.s("hn_m",db.me);ls.s("hn_a",db.a)};
const me=()=>db.c.find(c=>c.tel===db.me);
let sel=new Set(),date=null,time=null,pend=false;
const key=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const wins=d=>d.getDay()==0?[]:[[540,720],[780,d.getDay()==6?1140:1200]];
const dur=()=>[...sel].reduce((a,i)=>a+SV.find(s=>s.id==i).d,0),tot=()=>[...sel].reduce((a,i)=>a+SV.find(s=>s.id==i).p,0);
const days=[...Array(14)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return d});
const dl=k=>k.split("-").reverse().join("/").slice(0,5);

function slots(d,D=dur(),ex=null){const k=key(d),n=new Date(),now=key(n)==k?n.getHours()*60+n.getMinutes()+30:0,out=[];
 wins(d).forEach(([a,b])=>{for(let s=a;s+D<=b;s+=30){if(s<now)continue;
  const c=db.a.filter(x=>x.id!=ex&&x.date==k&&x.s<s+D&&s<x.s+x.dur).length;if(c<2)out.push(s)}});return out}

function rSvc(){$("#svcs").innerHTML=SV.map(s=>`<label class="svc"><input type="checkbox" value="${s.id}" ${sel.has(s.id)?"checked":""}><b>${s.n}</b><span>${s.d} min</span><em>${R(s.p)}</em></label>`).join("");
 document.querySelectorAll("#svcs input").forEach(i=>i.onchange=()=>{i.checked?sel.add(+i.value):sel.delete(+i.value);time=null;rSlots();rSum()})}
function rDays(){$("#days").innerHTML=days.map(d=>{const k=key(d),off=!wins(d).length;
 return `<label class="chip"><input type="radio" name="dia" value="${k}" ${off?"disabled":""} ${date==k?"checked":""}><span>${d.toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","")}<b>${d.getDate()}</b></span></label>`}).join("");
 document.querySelectorAll("#days input").forEach(i=>i.onchange=()=>{date=i.value;time=null;rSlots();rSum()})}
function rSlots(){const el=$("#slots");
 if(!sel.size||!date){el.innerHTML='<p>Escolha os serviços e o dia para ver os horários.</p>';return}
 const l=slots(days.find(d=>key(d)==date));
 el.innerHTML=l.length?l.map(s=>`<label class="chip t"><input type="radio" name="hora" value="${s}" ${time===s?"checked":""}><span>${hm(s)}</span></label>`).join(""):"<p>Sem horários nesse dia para o tempo escolhido. Tente outro dia.</p>";
 el.querySelectorAll("input").forEach(i=>i.onchange=()=>{time=+i.value;rSum()})}
function rSum(){const l=[...sel].map(i=>SV.find(s=>s.id==i));
 $("#sl").innerHTML=l.map(s=>`<li>${s.n}</li>`).join("")||"<li>Nenhum serviço marcado</li>";
 $("#st").textContent=sel.size?dur()+" min":"A definir";$("#sp").textContent=R(tot());
 $("#sw").textContent=date&&time!=null?dl(date)+" às "+hm(time):"A definir";
 $("#ok").disabled=!(sel.size&&date&&time!=null);if(!$("#ok").disabled)$("#msg").textContent=me()?"Agendando como "+me().nome.split(" ")[0]+".":"Você faz um cadastro rápido antes de confirmar."}

function confirm(){const u=me();if(!u){pend=true;openD("reg");return}
 const a={id:Date.now(),tel:u.tel,date,s:time,dur:dur(),sv:[...sel].map(i=>SV.find(s=>s.id==i).n),total:tot()};
 if(slots(days.find(d=>key(d)==date)).indexOf(time)<0){$("#msg").textContent="Esse horário acabou de ser preenchido. Escolha outro.";time=null;rSlots();rSum();return}
 db.a.push(a);save();
 const t=encodeURIComponent(`Olá! Sou ${u.nome} e agendei ${a.sv.join(", ")} para ${dl(a.date)} às ${hm(a.s)}.`);
 $("#msg").innerHTML=`Agendado: ${dl(a.date)} às ${hm(a.s)}. <a href="https://wa.me/5581973178238?text=${t}" target="_blank" rel="noopener">Avisar no WhatsApp</a>`;
 time=null;sel.clear();rSvc();rSlots();$("#st").textContent="A definir";$("#sp").textContent=R(0);$("#sw").textContent="A definir";$("#sl").innerHTML="<li>Nenhum serviço marcado</li>";$("#ok").disabled=true}

const D=$("#dlg");
let ed=null,after=null;
const edDur=()=>[...ed.sel].reduce((a,i)=>a+SV.find(s=>s.id==i).d,0),edTot=()=>[...ed.sel].reduce((a,i)=>a+SV.find(s=>s.id==i).p,0);
const edSlots=()=>{const d=days.find(d=>key(d)==ed.date);return d&&ed.sel.size?slots(d,edDur(),ed.id):[]};
const fone=t=>t.length==11?`(${t.slice(0,2)}) ${t.slice(2,7)}-${t.slice(7)}`:`(${t.slice(0,2)}) ${t.slice(2,6)}-${t.slice(6)}`;

function rEdit(b,done){
 b.innerHTML=`<fieldset><legend>Serviços</legend><div class="esv"></div></fieldset><fieldset><legend>Dia</legend><div class="chips edy"></div></fieldset><fieldset><legend>Horário</legend><div class="chips esl" aria-live="polite"></div></fieldset>
 <div class="row" style="margin-top:20px"><span>Tempo</span><b class="et"></b></div><div class="row"><span>Quando</span><b class="ew"></b></div><div class="row"><span>Total</span><b class="ep"></b></div>
 <div class="msg em" role="status"></div><div class="acts" style="margin-top:16px"><button class="b" type="button" id="es">Salvar alterações</button><button class="b o" type="button" id="ev">Voltar sem salvar</button></div>`;
 const q=x=>b.querySelector(x);
 const sum=()=>{const ok=ed.sel.size&&ed.date&&ed.time!=null;q(".et").textContent=ed.sel.size?edDur()+" min":"Nenhum serviço";q(".ep").textContent=R(edTot());
  q(".ew").textContent=ok?dl(ed.date)+" às "+hm(ed.time):"Escolha dia e horário";q("#es").disabled=!ok};
 const sl=()=>{const l=edSlots();if(ed.time!=null&&l.indexOf(ed.time)<0)ed.time=null;
  q(".esl").innerHTML=!ed.sel.size||!ed.date?"<p>Escolha os serviços e o dia para ver os horários.</p>":l.length?l.map(t=>`<label class="chip t"><input type="radio" name="ed-hora" value="${t}" ${ed.time===t?"checked":""}><span>${hm(t)}</span></label>`).join(""):"<p>Sem horários nesse dia para o tempo escolhido. Tente outro dia.</p>";
  q(".esl").querySelectorAll("input").forEach(i=>i.onchange=()=>{ed.time=+i.value;sum()});sum()};
 q(".esv").innerHTML=SV.map(s=>`<label class="svc"><input type="checkbox" value="${s.id}" ${ed.sel.has(s.id)?"checked":""}><b>${s.n}</b><span>${s.d} min</span><em>${R(s.p)}</em></label>`).join("");
 q(".esv").querySelectorAll("input").forEach(i=>i.onchange=()=>{i.checked?ed.sel.add(+i.value):ed.sel.delete(+i.value);sl()});
 q(".edy").innerHTML=days.map(d=>{const k=key(d),off=!wins(d).length;return `<label class="chip"><input type="radio" name="ed-dia" value="${k}" ${off?"disabled":""} ${ed.date==k?"checked":""}><span>${d.toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","")}<b>${d.getDate()}</b></span></label>`}).join("");
 q(".edy").querySelectorAll("input").forEach(i=>i.onchange=()=>{ed.date=i.value;sl()});
 q("#ev").onclick=done;
 q("#es").onclick=()=>{if(edSlots().indexOf(ed.time)<0){q(".em").textContent="Esse horário acabou de ser preenchido. Escolha outro.";sl();return}
  const a=db.a.find(x=>x.id==ed.id);if(!a)return done();
  Object.assign(a,{date:ed.date,s:ed.time,dur:edDur(),sv:[...ed.sel].map(i=>SV.find(s=>s.id==i).n),total:edTot()});save();rSlots();done()};
 sl()}

function acct(){const u=me();$("#acct").textContent=u?"Olá, "+u.nome.split(" ")[0]:"Entrar";$("#tabc span").textContent=u?"Conta":"Entrar"}
const tabs=[...document.querySelectorAll(".tab a")];
function setTab(id){tabs.forEach(a=>a.toggleAttribute("aria-current",a.dataset.t==id));tabs.forEach(a=>{if(a.dataset.t!=id)a.removeAttribute("aria-current")})}
let sec="";
if("IntersectionObserver" in window){const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)sec=e.target.id});if(!$("#conta").hidden)return;setTab(sec)},{rootMargin:"-40% 0px -55% 0px"});
 ["agendar","equipe","duvidas","onde"].forEach(i=>io.observe($("#"+i)))}

/* Página "Minha conta" (vista própria dentro do site, em #conta) */
function rConta(){const u=me(),v=$("#conta");if(!u)return;
 const mine=()=>db.a.filter(a=>a.tel==u.tel).sort((x,y)=>(x.date+hm(x.s)).localeCompare(y.date+hm(y.s)));
 v.innerHTML=`<section class="acc"><div class="w"><a class="lk back" href="#agendar">← Voltar ao site</a><span class="k">Minha conta</span><h2>Olá, ${esc(u.nome.split(" ")[0])}</h2>
 <div class="acc-g"><div class="acc-c"><h3>Meu cadastro</h3><dl class="prof"><dt>Nome</dt><dd>${esc(u.nome)}</dd><dt>WhatsApp</dt><dd>${fone(u.tel)}</dd><dt>E-mail</dt><dd>${u.email?esc(u.email):"Não informado"}</dd>${u.desde?`<dt>Cliente desde</dt><dd>${dl(u.desde)}/${u.desde.slice(0,4)}</dd>`:""}<dt>Agendamentos marcados</dt><dd>${mine().length}</dd></dl>
 <button class="b o" type="button" id="lo" style="width:100%;margin-top:24px">Sair da conta</button></div><div class="acc-a"></div></div></div></section>`;
 $("#lo").onclick=()=>{db.me=null;save();acct();rSum();location.hash=""};
 const A=v.querySelector(".acc-a");
 const list=()=>{ed=null;const l=mine();
  A.innerHTML="<h3>Meus agendamentos</h3>"+(l.map(a=>`<div class="ap"><div>${dl(a.date)} às ${hm(a.s)}<small>${esc(a.sv.join(", "))} · ${R(a.total)}</small></div><div class="ac"><button class="e" data-e="${a.id}">Editar</button><button data-c="${a.id}">Cancelar</button></div></div>`).join("")||"<p style='margin:16px 0'>Você ainda não tem horários marcados.</p>")+'<a class="b" href="#agendar" style="margin-top:28px">Novo agendamento</a>';
  A.querySelectorAll("[data-e]").forEach(x=>x.onclick=()=>edit(x.dataset.e));
  A.querySelectorAll("[data-c]").forEach(x=>x.onclick=()=>{db.a=db.a.filter(a=>a.id!=x.dataset.c);save();rSlots();rConta()})};
 const edit=id=>{const a=db.a.find(x=>x.id==id);if(!a)return;
  ed={id:a.id,sel:new Set(SV.filter(s=>a.sv.includes(s.n)).map(s=>s.id)),date:days.some(d=>key(d)==a.date)?a.date:null,time:a.s};
  A.innerHTML='<h3>Editar agendamento</h3><div class="ebox"></div>';rEdit(A.querySelector(".ebox"),()=>rConta())};
 list()}
function route(){let on=location.hash=="#conta";
 if(on&&!me()){try{history.replaceState(null,"",location.pathname+location.search)}catch(e){}on=false;after="conta";openD("in")}
 $("#conta").hidden=!on;$("#top").hidden=on;
 if(on)setTab("conta");else setTab(sec);
 if(on){rConta();window.scrollTo(0,0)}else{const h=location.hash.slice(1),el=h&&document.getElementById(h);if(el)el.scrollIntoView()}}
window.addEventListener("hashchange",route);

function openD(v){const b=$("#dbody"),t=$("#dt");
 const reg=v=="reg";t.textContent=reg?"Criar cadastro":"Entrar";
 b.innerHTML=`<div class="tabs" role="tablist"><button role="tab" aria-selected="${reg}" data-v="reg">Cadastro</button><button role="tab" aria-selected="${!reg}" data-v="in">Já sou cliente</button></div>
  <form novalidate>${reg?'<label>Nome completo<input type="text" name="n" autocomplete="name"><span class="err"></span></label>':""}<label>WhatsApp com DDD<input type="tel" name="t" inputmode="tel" autocomplete="tel" placeholder="(81) 90000-0000"><span class="err"></span></label>${reg?'<label>E-mail (opcional)<input type="email" name="e" autocomplete="email"><span class="err"></span></label>':""}<button class="b" type="submit">${reg?"Cadastrar e continuar":"Entrar"}</button></form>`;
 b.querySelectorAll("[data-v]").forEach(x=>x.onclick=()=>openD(x.dataset.v));
 b.querySelector("form").onsubmit=e=>{e.preventDefault();const f=e.target,er=(n,m)=>{const i=f.elements[n];if(!i)return;i.setAttribute("aria-invalid",!!m);i.nextElementSibling.textContent=m||""};
  const tel=f.t.value.replace(/\D/g,""),nome=f.n?f.n.value.trim():"";let bad=false;
  if(reg){er("n",nome.split(" ").length<2?"Informe nome e sobrenome.":"");bad=nome.split(" ").length<2;const em=f.e.value.trim();const eb=em&&!/^\S+@\S+\.\S+$/.test(em);er("e",eb?"E-mail inválido.":"");bad=bad||eb}
  const tb=tel.length<10||tel.length>11;er("t",tb?"Informe o DDD e o número.":"");if(bad||tb)return;
  if(reg){if(db.c.some(c=>c.tel==tel)){er("t","Esse número já tem cadastro. Use “Já sou cliente”.");return}db.c.push({nome,tel,email:f.e.value.trim(),desde:key(new Date())})}
  else if(!db.c.some(c=>c.tel==tel)){er("t","Não encontramos esse número. Faça o cadastro.");return}
  const go=after;after=null;db.me=tel;save();acct();D.close();rSum();if(pend){pend=false;confirm()}else if(go)location.hash=go}
 if(!D.open)D.showModal()}
$("#acct").onclick=()=>{if(me())location.hash="conta";else{after="conta";openD("in")}};
$("#cx").onclick=()=>{pend=false;after=null;D.close()};
document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{after=null;openD(b.dataset.open)});
D.addEventListener("click",e=>{if(e.target==D){after=null;D.close()}});$("#ok").onclick=confirm;

const H=["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"],td=new Date().getDay();
$("#hrs").innerHTML=[1,2,3,4,5,6,0].map(i=>`<dt class="${i==td?"today":""}">${H[i]}${i==td?" · hoje":""}</dt><dd>${i==0?"Fechado":i==6?"09:00–12:00 · 13:00–19:00":"09:00–12:00 · 13:00–20:00"}</dd>`).join("");
acct();rSvc();rDays();rSlots();rSum();route();
