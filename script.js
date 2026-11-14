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

function slots(d){const D=dur(),k=key(d),n=new Date(),now=key(n)==k?n.getHours()*60+n.getMinutes()+30:0,out=[];
 wins(d).forEach(([a,b])=>{for(let s=a;s+D<=b;s+=30){if(s<now)continue;
  const c=db.a.filter(x=>x.date==k&&x.s<s+D&&s<x.s+x.dur).length;if(c<2)out.push(s)}});return out}

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
 $("#st").textContent=sel.size?dur()+" min":"—";$("#sp").textContent=R(tot());
 $("#sw").textContent=date&&time!=null?dl(date)+" às "+hm(time):"—";
 $("#ok").disabled=!(sel.size&&date&&time!=null);if(!$("#ok").disabled)$("#msg").textContent=me()?"Agendando como "+me().nome.split(" ")[0]+".":"Você será pedido a fazer o cadastro rápido."}

function confirm(){const u=me();if(!u){pend=true;openD("reg");return}
 const a={id:Date.now(),tel:u.tel,date,s:time,dur:dur(),sv:[...sel].map(i=>SV.find(s=>s.id==i).n),total:tot()};
 if(slots(days.find(d=>key(d)==date)).indexOf(time)<0){$("#msg").textContent="Esse horário acabou de ser preenchido. Escolha outro.";time=null;rSlots();rSum();return}
 db.a.push(a);save();
 const t=encodeURIComponent(`Olá! Sou ${u.nome} e agendei ${a.sv.join(", ")} para ${dl(a.date)} às ${hm(a.s)}.`);
 $("#msg").innerHTML=`Agendado: ${dl(a.date)} às ${hm(a.s)}. <a href="https://wa.me/5581973178238?text=${t}" target="_blank" rel="noopener">Avisar no WhatsApp</a>`;
 time=null;sel.clear();rSvc();rSlots();$("#st").textContent="—";$("#sp").textContent=R(0);$("#sw").textContent="—";$("#sl").innerHTML="<li>Nenhum serviço marcado</li>";$("#ok").disabled=true}

const D=$("#dlg");
function acct(){const u=me();$("#acct").textContent=u?"Olá, "+u.nome.split(" ")[0]:"Entrar"}
function openD(v){const b=$("#dbody"),t=$("#dt");
 if(v=="mine"){t.textContent="Meus agendamentos";const l=db.a.filter(a=>a.tel==db.me).sort((x,y)=>(x.date+hm(x.s)).localeCompare(y.date+hm(y.s)));
  b.innerHTML=(l.map(a=>`<div class="ap"><div>${dl(a.date)} às ${hm(a.s)}<small>${esc(a.sv.join(", "))} · ${R(a.total)}</small></div><button data-c="${a.id}">Cancelar</button></div>`).join("")||"<p style='margin:16px 0'>Você ainda não tem horários marcados.</p>")+'<button class="b o" type="button" id="lo" style="width:100%;margin-top:20px">Sair da conta</button>';
  b.querySelectorAll("[data-c]").forEach(x=>x.onclick=()=>{db.a=db.a.filter(a=>a.id!=x.dataset.c);save();rSlots();openD("mine")});
  $("#lo").onclick=()=>{db.me=null;save();acct();rSum();D.close()}}
 else{const reg=v=="reg";t.textContent=reg?"Criar cadastro":"Entrar";
  b.innerHTML=`<div class="tabs" role="tablist"><button role="tab" aria-selected="${reg}" data-v="reg">Cadastro</button><button role="tab" aria-selected="${!reg}" data-v="in">Já sou cliente</button></div>
  <form novalidate>${reg?'<label>Nome completo<input type="text" name="n" autocomplete="name"><span class="err"></span></label>':""}<label>WhatsApp com DDD<input type="tel" name="t" inputmode="tel" autocomplete="tel" placeholder="(81) 90000-0000"><span class="err"></span></label>${reg?'<label>E-mail (opcional)<input type="email" name="e" autocomplete="email"><span class="err"></span></label>':""}<button class="b" type="submit">${reg?"Cadastrar e continuar":"Entrar"}</button></form>`;
  b.querySelectorAll("[data-v]").forEach(x=>x.onclick=()=>openD(x.dataset.v));
  b.querySelector("form").onsubmit=e=>{e.preventDefault();const f=e.target,er=(n,m)=>{const i=f.elements[n];if(!i)return;i.setAttribute("aria-invalid",!!m);i.nextElementSibling.textContent=m||""};
   const tel=f.t.value.replace(/\D/g,""),nome=f.n?f.n.value.trim():"";let bad=false;
   if(reg){er("n",nome.split(" ").length<2?"Informe nome e sobrenome.":"");bad=nome.split(" ").length<2;const em=f.e.value.trim();const eb=em&&!/^\S+@\S+\.\S+$/.test(em);er("e",eb?"E-mail inválido.":"");bad=bad||eb}
   const tb=tel.length<10||tel.length>11;er("t",tb?"Informe o DDD e o número.":"");if(bad||tb)return;
   if(reg){if(db.c.some(c=>c.tel==tel)){er("t","Esse número já tem cadastro. Use “Já sou cliente”.");return}db.c.push({nome,tel,email:f.e.value.trim()})}
   else if(!db.c.some(c=>c.tel==tel)){er("t","Não encontramos esse número. Faça o cadastro.");return}
   db.me=tel;save();acct();D.close();rSum();if(pend){pend=false;confirm()}}}
 if(!D.open)D.showModal()}
$("#acct").onclick=()=>openD(me()?"mine":"in");$("#cx").onclick=()=>{pend=false;D.close()};
document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openD(b.dataset.open));
D.addEventListener("click",e=>{if(e.target==D)D.close()});$("#ok").onclick=confirm;

const H=["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"],td=new Date().getDay();
$("#hrs").innerHTML=[1,2,3,4,5,6,0].map(i=>`<dt class="${i==td?"today":""}">${H[i]}${i==td?" · hoje":""}</dt><dd>${i==0?"Fechado":i==6?"09:00–12:00 · 13:00–19:00":"09:00–12:00 · 13:00–20:00"}</dd>`).join("");
acct();rSvc();rDays();rSlots();rSum();
