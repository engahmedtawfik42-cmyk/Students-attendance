(() => {
  "use strict";
  const DEFAULT_URL = "https://corse-c943d-default-rtdb.firebaseio.com/";
  const $ = id => document.getElementById(id);
  const state = { students:{}, groups:{}, attendance:{}, payments:{}, editingStudent:null, editingGroup:null, paymentStudent:null, busy:false, url:localStorage.getItem("sas_firebase_url") || DEFAULT_URL, lastReport:null };
  const money = n => `${Number(n||0).toLocaleString("en-US",{maximumFractionDigits:2})} ج.م`;
  const today = () => new Date().toLocaleDateString("en-CA");
  const nowTime = () => new Date().toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"});
  const dateTime = v => v ? new Date(v).toLocaleString("ar-EG") : "—";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const values = obj => Object.entries(obj||{}).map(([id,v])=>({id,...(v||{})}));
  const totalPaid = s => values(state.payments).filter(p=>p.studentId===s.id).reduce((a,p)=>a+Number(p.amount||0),0);
  const feeFor = s => Number(s.fee ?? state.groups[s.groupId]?.fee ?? 0);
  const balance = s => Math.max(0,feeFor(s)-totalPaid(s));
  const dateInRange = (date,from,to) => date >= from && date <= to;
  const setFeedback = (id,msg,type="info") => { const el=$(id); if(!el)return; el.className=`feedback ${type}`; el.textContent=msg; };
  const firebaseUrl = () => (state.url || DEFAULT_URL).replace(/\/+$/,"");
  async function api(path, options={}) {
    const response = await fetch(`${firebaseUrl()}/${path}.json`, {
      method: options.method || "GET",
      headers: {"Content-Type":"application/json"},
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache:"no-store"
    });
    const text = await response.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) throw new Error(data?.error || `Firebase HTTP ${response.status}: ${text.slice(0,180)}`);
    if (data && data.error) throw new Error(data.error);
    return data;
  }
  async function save(path,data) { await api(path,{method:"PUT",body:data}); }
  async function create(path,data) { return api(path,{method:"POST",body:data}); }
  async function remove(path) { await api(path,{method:"DELETE"}); }

  async function loadData(showError=true) {
    try {
      const data = await api("");
      state.students = data?.students || {};
      state.groups = data?.groups || {};
      state.attendance = data?.attendance || {};
      state.payments = data?.payments || {};
      setConnection(true,"متصل بقاعدة البيانات");
      renderAll();
      return true;
    } catch(err) {
      setConnection(false,"تعذر الاتصال");
      if(showError) alert(`تعذر تحميل البيانات من Firebase.\n${err.message}\n\nتحقق من الاتصال وقواعد صلاحيات Realtime Database.`);
      return false;
    }
  }
  function setConnection(ok,msg) { $("connectionDot").style.background=ok?"#4ce0a0":"#ff737d"; $("connectionText").textContent=msg; }
  function studentByCode(code) { const norm=String(code||"").trim().toLowerCase(); return values(state.students).find(s=>String(s.code||"").trim().toLowerCase()===norm); }
  function groupName(id) { return state.groups[id]?.name || "بدون مجموعة"; }
  function page(name) {
    document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${name}`));
    document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
    if(name==="attendance") $("attendanceCode").focus();
    if(name==="payments") $("paymentCode").focus();
  }
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>page(b.dataset.page)));
  $("refreshBtn").addEventListener("click",()=>loadData());
  function renderAll() { renderDashboard(); renderAttendance(); renderPayments(); renderStudents(); renderGroups(); fillGroupOptions(); renderReport(); }
  function renderDashboard() {
    const students=values(state.students), attendance=values(state.attendance).filter(a=>a.date===today()), payments=values(state.payments);
    $("statStudents").textContent=students.length;
    $("statAttendance").textContent=attendance.length;
    $("statTodayMoney").textContent=money(payments.filter(p=>p.date===today()).reduce((a,p)=>a+Number(p.amount||0),0));
    $("statDue").textContent=money(students.reduce((a,s)=>a+balance(s),0));
    $("recentAttendance").innerHTML=attendance.length?`<div class="mini-list">${attendance.slice().sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,6).map(a=>`<div class="mini-row"><strong>${esc(a.studentName)}</strong><span>${esc(a.time||"")}</span></div>`).join("")}</div>`:'<div class="empty">لا توجد عمليات حضور اليوم.</div>';
    const recent=payments.slice().sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,6);
    $("recentPayments").innerHTML=recent.length?`<div class="mini-list">${recent.map(p=>`<div class="mini-row"><strong>${esc(p.studentName)}</strong><span>${money(p.amount)}</span></div>`).join("")}</div>`:'<div class="empty">لا توجد مدفوعات مسجلة.</div>';
  }
  function renderAttendance() {
    const arr=values(state.attendance).filter(a=>a.date===today()).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
    $("attendanceCount").textContent=`${arr.length} تسجيل`;
    $("attendanceTable").innerHTML=table(["كود الطالب","اسم الطالب","المجموعة","التاريخ","الوقت"],arr.map(a=>[esc(a.studentCode),esc(a.studentName),esc(groupName(a.groupId)),esc(a.date),esc(a.time)]),"لا يوجد حضور مسجل اليوم.");
  }
  function renderPayments() {
    const arr=values(state.payments).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
    $("paymentsTable").innerHTML=table(["التاريخ","كود الطالب","اسم الطالب","المبلغ","ملاحظة"],arr.slice(0,100).map(p=>[esc(p.date),esc(p.studentCode),esc(p.studentName),`<strong>${money(p.amount)}</strong>`,esc(p.note||"—")]),"لا توجد مدفوعات مسجلة.");
  }
  function table(headers,rows,empty) {
    if(!rows.length)return `<div class="empty-state">${empty}</div>`;
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  function fillGroupOptions() {
    const opts=values(state.groups).sort((a,b)=>a.name.localeCompare(b.name,"ar")).map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("");
    $("studentGroup").innerHTML='<option value="">بدون مجموعة</option>'+opts;
    const old=$("studentGroupFilter").value;
    $("studentGroupFilter").innerHTML='<option value="">كل المجموعات</option>'+opts;
    $("studentGroupFilter").value=old;
  }
  function renderStudents() {
    const query=$("studentSearch").value.trim().toLowerCase(), group=$("studentGroupFilter").value;
    const arr=values(state.students).filter(s=>(!group||s.groupId===group)&&(!query||[s.code,s.name,s.phone].some(x=>String(x||"").toLowerCase().includes(query)))).sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));
    $("studentsTable").innerHTML=table(["الكود","اسم الطالب","المجموعة","الهاتف","الاشتراك","المدفوع","المتبقي","إجراءات"],arr.map(s=>[
      `<strong>${esc(s.code)}</strong>`,esc(s.name),esc(groupName(s.groupId)),esc(s.phone||"—"),money(feeFor(s)),money(totalPaid(s)),`<span class="status ${balance(s)>0?"bad":"good"}">${money(balance(s))}</span>`,
      `<button class="small-btn" data-edit-student="${esc(s.id)}">تعديل</button> <button class="small-btn danger" data-delete-student="${esc(s.id)}">حذف</button>`
    ]),"لا يوجد طلاب مطابقون.");
    $("studentsTable").querySelectorAll("[data-edit-student]").forEach(b=>b.addEventListener("click",()=>editStudent(b.dataset.editStudent)));
    $("studentsTable").querySelectorAll("[data-delete-student]").forEach(b=>b.addEventListener("click",()=>deleteStudent(b.dataset.deleteStudent)));
  }
  function renderGroups() {
    const arr=values(state.groups).sort((a,b)=>String(a.name).localeCompare(String(b.name),"ar"));
    $("groupsTable").innerHTML=table(["المجموعة","المدرس","الموعد","سعر الاشتراك","عدد الطلاب","إجراءات"],arr.map(g=>[
      `<strong>${esc(g.name)}</strong>`,esc(g.teacher||"—"),esc(g.schedule||"—"),money(g.fee),values(state.students).filter(s=>s.groupId===g.id).length,
      `<button class="small-btn" data-edit-group="${esc(g.id)}">تعديل</button> <button class="small-btn danger" data-delete-group="${esc(g.id)}">حذف</button>`
    ]),"لا توجد مجموعات حتى الآن.");
    $("groupsTable").querySelectorAll("[data-edit-group]").forEach(b=>b.addEventListener("click",()=>editGroup(b.dataset.editGroup)));
    $("groupsTable").querySelectorAll("[data-delete-group]").forEach(b=>b.addEventListener("click",()=>deleteGroup(b.dataset.deleteGroup)));
  }
  async function registerAttendance() {
    const code=$("attendanceCode").value.trim(), fb="attendanceMessage";
    if(!code){setFeedback(fb,"اكتب كود الطالب أولًا.","error");return;}
    const s=studentByCode(code);
    if(!s){setFeedback(fb,"الكود غير موجود. تأكد من الكود أو أضف الطالب أولًا.","error");return;}
    const exists=values(state.attendance).some(a=>a.studentId===s.id&&a.date===today());
    if(exists){setFeedback(fb,`تم تسجيل حضور ${s.name} بالفعل اليوم. لن يتم تكرار التسجيل.`,"error");return;}
    try{
      setFeedback(fb,"جارٍ تسجيل الحضور...","info");
      const record={studentId:s.id,studentCode:s.code,studentName:s.name,groupId:s.groupId||"",date:today(),time:nowTime(),timestamp:Date.now()};
      const result=await create("attendance",record);
      state.attendance[result.name]=record;
      $("attendanceCode").value=""; setFeedback(fb,`تم تسجيل حضور ${s.name} بنجاح — ${record.time}`,"success");
      renderAll(); $("attendanceCode").focus();
    }catch(e){setFeedback(fb,`فشل تسجيل الحضور: ${e.message}`,"error");}
  }
  $("attendanceSubmit").addEventListener("click",registerAttendance);
  $("attendanceCode").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();registerAttendance();}});
  $("newStudentBtn").addEventListener("click",()=>{state.editingStudent=null;$("studentForm").reset();$("studentFee").value=0;$("studentFormTitle").textContent="إضافة طالب";$("studentFormPanel").classList.remove("hidden");fillGroupOptions();$("studentCode").focus();});
  $("cancelStudentBtn").addEventListener("click",()=>$("studentFormPanel").classList.add("hidden"));
  function editStudent(id) {
    const s=state.students[id];if(!s)return;state.editingStudent=id;fillGroupOptions();
    $("studentCode").value=s.code||"";$("studentName").value=s.name||"";$("studentPhone").value=s.phone||"";$("studentGroup").value=s.groupId||"";$("studentFee").value=s.fee??0;$("studentNotes").value=s.notes||"";
    $("studentFormTitle").textContent="تعديل بيانات الطالب";$("studentFormPanel").classList.remove("hidden");page("students");window.scrollTo({top:0,behavior:"smooth"});
  }
  $("studentForm").addEventListener("submit",async e=>{
    e.preventDefault();const code=$("studentCode").value.trim(), name=$("studentName").value.trim();
    if(!code||!name)return;
    const duplicate=values(state.students).find(s=>String(s.code).toLowerCase()===code.toLowerCase()&&s.id!==state.editingStudent);
    if(duplicate){alert("كود الطالب مستخدم بالفعل.");return;}
    const id=state.editingStudent||`student_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const item={code,name,phone:$("studentPhone").value.trim(),groupId:$("studentGroup").value||"",fee:Number($("studentFee").value||0),notes:$("studentNotes").value.trim(),updatedAt:Date.now()};
    try{await save(`students/${id}`,item);state.students[id]=item;$("studentFormPanel").classList.add("hidden");renderAll();alert("تم حفظ بيانات الطالب.");}
    catch(err){alert(`تعذر حفظ الطالب: ${err.message}`);}
  });
  async function deleteStudent(id){const s=state.students[id];if(!s||!confirm(`حذف الطالب ${s.name}؟ لن تُحذف سجلات الدفع والحضور السابقة تلقائيًا.`))return;try{await remove(`students/${id}`);delete state.students[id];renderAll();}catch(e){alert(e.message);}}
  $("studentSearch").addEventListener("input",renderStudents);$("studentGroupFilter").addEventListener("change",renderStudents);
  $("newGroupBtn").addEventListener("click",()=>{state.editingGroup=null;$("groupForm").reset();$("groupFee").value=0;$("groupFormTitle").textContent="إضافة مجموعة";$("groupFormPanel").classList.remove("hidden");$("groupName").focus();});
  $("cancelGroupBtn").addEventListener("click",()=>$("groupFormPanel").classList.add("hidden"));
  function editGroup(id){const g=state.groups[id];if(!g)return;state.editingGroup=id;$("groupName").value=g.name||"";$("groupTeacher").value=g.teacher||"";$("groupSchedule").value=g.schedule||"";$("groupFee").value=g.fee||0;$("groupFormTitle").textContent="تعديل المجموعة";$("groupFormPanel").classList.remove("hidden");page("groups");window.scrollTo({top:0,behavior:"smooth"});}
  $("groupForm").addEventListener("submit",async e=>{e.preventDefault();const id=state.editingGroup||`group_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;const item={name:$("groupName").value.trim(),teacher:$("groupTeacher").value.trim(),schedule:$("groupSchedule").value.trim(),fee:Number($("groupFee").value||0),updatedAt:Date.now()};if(!item.name)return;try{await save(`groups/${id}`,item);state.groups[id]=item;$("groupFormPanel").classList.add("hidden");renderAll();alert("تم حفظ المجموعة.");}catch(err){alert(`تعذر حفظ المجموعة: ${err.message}`);}});
  async function deleteGroup(id){const g=state.groups[id];if(!g)return;if(values(state.students).some(s=>s.groupId===id)){alert("لا يمكن حذف مجموعة بها طلاب. انقل الطلاب إلى مجموعة أخرى أولًا.");return;}if(!confirm(`حذف المجموعة ${g.name}؟`))return;try{await remove(`groups/${id}`);delete state.groups[id];renderAll();}catch(e){alert(e.message);}}
  function findPaymentStudent(){const s=studentByCode($("paymentCode").value);const card=$("paymentStudentCard"),form=$("paymentForm");state.paymentStudent=s?.id||null;if(!s){card.classList.add("hidden");form.classList.add("hidden");setFeedback("paymentMessage","لم يتم العثور على طالب بهذا الكود.","error");return;}card.classList.remove("hidden");form.classList.remove("hidden");card.innerHTML=`<strong>${esc(s.name)}</strong><br>الكود: ${esc(s.code)} · المجموعة: ${esc(groupName(s.groupId))}<br>قيمة الاشتراك: <b>${money(feeFor(s))}</b> · إجمالي المدفوع: <b>${money(totalPaid(s))}</b> · المتبقي: <b class="${balance(s)>0?"status bad":"status good"}">${money(balance(s))}</b>`;setFeedback("paymentMessage","","info");$("paymentAmount").focus();}
  $("findPaymentStudent").addEventListener("click",findPaymentStudent);
  $("paymentCode").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();findPaymentStudent();}});
  $("paymentForm").addEventListener("submit",async e=>{e.preventDefault();const s=state.students[state.paymentStudent],amount=Number($("paymentAmount").value);if(!s){setFeedback("paymentMessage","ابحث عن الطالب أولًا.","error");return;}if(!Number.isFinite(amount)||amount<=0){setFeedback("paymentMessage","اكتب مبلغًا صحيحًا أكبر من صفر.","error");return;}const item={studentId:s.id,studentCode:s.code,studentName:s.name,amount,note:$("paymentNote").value.trim(),date:today(),timestamp:Date.now()};try{const result=await create("payments",item);state.payments[result.name]=item;$("paymentAmount").value="";$("paymentNote").value="";findPaymentStudent();setFeedback("paymentMessage",`تم تسجيل دفعة ${money(amount)} للطالب ${s.name}.`,"success");renderAll();}catch(err){setFeedback("paymentMessage",`فشل تسجيل الدفع: ${err.message}`,"error");}});
  function defaultReportDates(){const d=new Date();$("reportTo").value=d.toLocaleDateString("en-CA");const first=new Date(d.getFullYear(),d.getMonth(),1);$("reportFrom").value=first.toLocaleDateString("en-CA");}
  function renderReport(){
    const from=$("reportFrom").value||today(),to=$("reportTo").value||today();
    const att=values(state.attendance).filter(a=>dateInRange(a.date||"",from,to));
    const pays=values(state.payments).filter(p=>dateInRange(p.date||"",from,to));
    const students=values(state.students), debtors=students.map(s=>({...s,paid:totalPaid(s),due:balance(s)})).filter(s=>s.due>0).sort((a,b)=>b.due-a.due);
    $("reportAttendance").textContent=att.length;$("reportCollected").textContent=money(pays.reduce((a,p)=>a+Number(p.amount||0),0));$("reportDebtors").textContent=debtors.length;$("reportDue").textContent=money(debtors.reduce((a,s)=>a+s.due,0));
    $("debtorsTable").innerHTML=table(["كود الطالب","اسم الطالب","المجموعة","الاشتراك","المدفوع إجمالًا","المتبقي"],debtors.map(s=>[esc(s.code),esc(s.name),esc(groupName(s.groupId)),money(feeFor(s)),money(s.paid),`<span class="status bad">${money(s.due)}</span>`]),"لا توجد متأخرات حاليًا.");
    state.lastReport={from,to,attendance:att,payments:pays,debtors};
  }
  $("runReportBtn").addEventListener("click",renderReport);
  function downloadCsv(filename,rows){const csv="\uFEFF"+rows.map(row=>row.map(v=>{const s=String(v??"");return `"${s.replace(/"/g,'""')}"`;}).join(",")).join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}
  $("exportReportBtn").addEventListener("click",()=>{renderReport();const r=state.lastReport;downloadCsv(`report_${r.from}_${r.to}.csv`,[["من","إلى"],[r.from,r.to],[],["كود الطالب","اسم الطالب","المجموعة","الاشتراك","المدفوع","المتبقي"],...r.debtors.map(s=>[s.code,s.name,groupName(s.groupId),feeFor(s),totalPaid(s),balance(s)]),[],["التاريخ","كود الطالب","اسم الطالب","المبلغ","ملاحظة"],...r.payments.map(p=>[p.date,p.studentCode,p.studentName,p.amount,p.note||""])]);});
  $("saveFirebaseUrl").addEventListener("click",()=>{const url=$("firebaseUrl").value.trim();if(!/^https:\/\/[^/]+\/?$/.test(url)){setFeedback("firebaseMessage","اكتب رابط Firebase صحيحًا يبدأ بـ https://","error");return;}state.url=url;localStorage.setItem("sas_firebase_url",url);setFeedback("firebaseMessage","تم حفظ رابط قاعدة البيانات على هذا الجهاز.","success");loadData();});
  $("testFirebase").addEventListener("click",async()=>{state.url=$("firebaseUrl").value.trim().replace(/\/+$/,"")+"/";try{await api("");setFeedback("firebaseMessage","الاتصال ناجح ويمكن قراءة البيانات.","success");setConnection(true,"متصل بقاعدة البيانات");}catch(e){setFeedback("firebaseMessage",`فشل الاختبار: ${e.message}`,"error");}});
  function parseCsv(text){
    const rows=[];let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(field);field="";}else if(c==='\n'){row.push(field.replace(/\r$/,""));rows.push(row);row=[];field="";}else field+=c;}
    if(field.length||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}return rows.filter(r=>r.some(c=>String(c).trim()));
  }
  const normHeader = h => String(h||"").trim().toLowerCase().replace(/[\s_\-]/g,"");
  const headerAliases={code:["code","studentcode","id","كودالطالب","الكود","كود"],name:["name","studentname","الاسم","اسمالطالب","اسم"],phone:["phone","mobile","parentphone","الهاتف","رقموليالامر","رقمالهاتف"],group:["group","groupname","المجموعة","اسمالمجموعة"],fee:["fee","price","subscription","الاشتراك","السعر"],notes:["notes","note","ملاحظات"]};
  function readField(row,headers,key){const idx=headers.findIndex(h=>headerAliases[key].includes(normHeader(h)));return idx>=0?String(row[idx]??"").trim():"";}
  $("importCsvBtn").addEventListener("click",async()=>{
    const file=$("csvFile").files[0];if(!file){setFeedback("csvMessage","اختر ملف CSV أولًا.","error");return;}
    try{
      const rows=parseCsv(await file.text());if(rows.length<2)throw new Error("الملف فارغ أو لا يحتوي على صفوف بيانات.");
      const headers=rows[0];if(headers.every(h=>!headerAliases.code.includes(normHeader(h)))||headers.every(h=>!headerAliases.name.includes(normHeader(h))))throw new Error("تأكد من وجود عمود كود الطالب وعمود اسم الطالب في أول صف.");
      const groupLookup=new Map(values(state.groups).map(g=>[g.name.trim().toLowerCase(),g.id]));let count=0,skipped=0;
      for(const row of rows.slice(1)){
        const code=readField(row,headers,"code"),name=readField(row,headers,"name");if(!code||!name){skipped++;continue;}
        let groupNameCsv=readField(row,headers,"group"),groupId=groupLookup.get(groupNameCsv.toLowerCase())||"";
        const existing=studentByCode(code);const id=existing?.id||`student_${Date.now()}_${count}_${Math.random().toString(36).slice(2,5)}`;
        const feeRaw=readField(row,headers,"fee");const item={...(existing||{}),code,name,phone:readField(row,headers,"phone"),groupId,fee:feeRaw?Number(feeRaw)||0:(existing?.fee||0),notes:readField(row,headers,"notes"),updatedAt:Date.now()};
        await save(`students/${id}`,item);state.students[id]=item;count++;
      }
      renderAll();setFeedback("csvMessage",`اكتمل الاستيراد: ${count} طالب، وتم تخطي ${skipped} صف غير مكتمل. الطلاب الموجودون بنفس الكود تم تحديث بياناتهم.`,"success");
    }catch(e){setFeedback("csvMessage",`تعذر الاستيراد: ${e.message}`,"error");}
  });
  $("exportStudentsBtn").addEventListener("click",()=>downloadCsv("students.csv",[["code","name","phone","group","fee","paid","due","notes"],...values(state.students).map(s=>[s.code,s.name,s.phone||"",groupName(s.groupId),feeFor(s),totalPaid(s),balance(s),s.notes||""])]));
  $("exportAllBtn").addEventListener("click",()=>downloadCsv("system_backup.csv",[["section","id","data_json"],...["students","groups","attendance","payments"].flatMap(section=>Object.entries(state[section]).map(([id,data])=>[section,id,JSON.stringify(data)]))]));
  defaultReportDates();
  $("firebaseUrl").value=state.url;
  loadData();
  // Poll Firebase periodically so changes made on another device appear without refreshing.
  setInterval(()=>{if(!document.hidden&&!state.busy)loadData(false);},7000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)loadData(false);});
})();