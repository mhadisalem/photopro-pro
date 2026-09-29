const $=s=>document.querySelector(s);
const video=$("#video"), canvas=$("#captureCanvas"), photo=$("#photo"), preview=$("#preview");
let stream=null, track=null, facing="environment", capabilities={}, settings={};
let zoom=1, aspect="4:3", timer=0, filter="none", pro=false, torch=false;
let iso="AUTO", shutter="AUTO", ev=0, wb="AUTO", focus="AF";
let gallery=[];
let lastBlob=null;

const ISO_VALUES=["AUTO","50","100","200","400","800","1600"];
const SHUTTER_VALUES=["AUTO","1/30","1/60","1/125","1/250","1/500","1/1000"];
const WB_VALUES=["AUTO","DAYLIGHT","CLOUDY","TUNGSTEN","FLUORESCENT"];

function toastMsg(t){const x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),1800)}
function setStatus(t){$("#status").textContent=t}
function fmt(n){return Number(n).toFixed(1)}
async function startCamera(){
  try{
    if(stream) stream.getTracks().forEach(t=>t.stop());
    stream=await navigator.mediaDevices.getUserMedia({video:{
      facingMode:{ideal:facing}, width:{ideal:2560}, height:{ideal:1440}
    },audio:false});
    video.srcObject=stream; track=stream.getVideoTracks()[0];
    capabilities=track.getCapabilities?track.getCapabilities():{};
    settings=track.getSettings?track.getSettings():{};
    const w=settings.width||video.videoWidth,h=settings.height||video.videoHeight;
    $("#resolution").textContent=w&&h?`${w}×${h}`:"AUTO";
    if(capabilities.zoom){$("#zoomSlider").min=capabilities.zoom.min||1;$("#zoomSlider").max=capabilities.zoom.max||4;zoom=Math.max(capabilities.zoom.min||1,1);$("#zoomSlider").value=zoom;$("#zoomMax").textContent=fmt(capabilities.zoom.max||4)+"×"}
    else{$("#zoomSlider").disabled=true;$("#zoomMax").textContent="FIXED"}
    setStatus("دوربین آماده است");
    await applyTrackControls();
  }catch(e){console.error(e);setStatus("دسترسی دوربین لازم است");toastMsg("اجازه دوربین را فعال کنید")}
}
async function applyTrackControls(){
  if(!track?.applyConstraints)return;
  const adv=[];
  if(capabilities.zoom) adv.push({zoom:Number(zoom)});
  if(capabilities.exposureCompensation) adv.push({exposureCompensation:Number(ev)});
  if(capabilities.focusMode && focus==="CONTINUOUS") adv.push({focusMode:"continuous"});
  else if(capabilities.focusMode && focus==="LOCK") adv.push({focusMode:"single-shot"});
  if(capabilities.whiteBalanceMode && wb==="AUTO") adv.push({whiteBalanceMode:"continuous"});
  try{if(adv.length) await track.applyConstraints({advanced:adv})}catch(e){}
}
function setZoom(z){
  zoom=Number(z);$("#zoomSlider").value=zoom;$("#zoomLabel").textContent=fmt(zoom)+"×";
  if(track)applyTrackControls();
}
document.querySelectorAll("[data-zoom]").forEach(b=>b.onclick=()=>setZoom(b.dataset.zoom));
$("#zoomSlider").oninput=e=>setZoom(e.target.value);

async function capture(){
  if(!stream){toastMsg("دوربین فعال نیست");return}
  const shoot=()=>{
    const vw=video.videoWidth,vh=video.videoHeight;
    if(!vw||!vh){toastMsg("دوربین هنوز آماده نشده");return}
    let cw=vw,ch=vh;
    if(aspect==="1:1"){const s=Math.min(vw,vh);cw=ch=s}
    if(aspect==="16:9"){const s=Math.min(vw,vh*16/9);cw=s;ch=s*9/16}
    if(aspect==="4:3"){const s=Math.min(vw,vh*4/3);cw=s;ch=s*3/4}
    canvas.width=Math.round(cw);canvas.height=Math.round(ch);
    const ctx=canvas.getContext("2d");
    let sx=(vw-cw)/2,sy=(vh-ch)/2;
    ctx.save();
    if(facing==="user"){ctx.translate(cw,0);ctx.scale(-1,1)}
    ctx.filter=filter;
    ctx.drawImage(video,sx,sy,cw,ch,0,0,cw,ch);
    ctx.restore();
    canvas.toBlob(blob=>{
      if(!blob)return;
      lastBlob=blob;photo.src=URL.createObjectURL(blob);photo.hidden=false;video.hidden=true;
      saveToGallery(blob);setStatus(`عکس ثبت شد • ${Math.round(cw)}×${Math.round(ch)}`);
    },"image/jpeg",.96);
  };
  if(timer){
    let n=timer;setStatus(`عکاسی در ${n}…`);
    const id=setInterval(()=>{n--;if(n<=0){clearInterval(id);shoot()}else setStatus(`عکاسی در ${n}…`)},1000)
  }else shoot();
}
$("#captureBtn").onclick=capture;

preview.onclick=async e=>{
  const r=preview.getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width*100,y=(e.clientY-r.top)/r.height*100;
  const ring=$("#focusRing");ring.style.left=x+"%";ring.style.top=y+"%";ring.style.display="block";
  setTimeout(()=>ring.style.display="none",700);
  if(track?.applyConstraints && capabilities.focusMode){
    try{await track.applyConstraints({advanced:[{focusMode:"single-shot"}]})}catch(_){}
  }
};

$("#flipBtn").onclick=()=>{facing=facing==="environment"?"user":"environment";startCamera()};
$("#torchTop").onclick=async()=>{if(!capabilities.torch){toastMsg("چراغ نرم‌افزاری دستگاه پشتیبانی نمی‌شود");return}torch=!torch;try{await track.applyConstraints({advanced:[{torch}]});toastMsg(torch?"چراغ روشن":"چراغ خاموش")}catch(_){toastMsg("چراغ توسط دستگاه پشتیبانی نمی‌شود")}};
$("#gridBtn").onclick=()=>$("#grid").classList.toggle("hidden");

$("#timerBtn").onclick=()=>{
  timer=timer===0?3:timer===3?5:10; if(timer===10)timer=0;
  $("#timerBtn b").textContent=timer?timer+"s":"OFF";toastMsg(timer?`تایمر ${timer} ثانیه`:"تایمر خاموش");
};
$("#aspectBtn").onclick=()=>{aspect=aspect==="4:3"?"16:9":aspect==="16:9"?"1:1":"4:3";$("#aspectText").textContent=aspect;toastMsg("نسبت تصویر: "+aspect)};
$("#proBtn").onclick=()=>{pro=!pro;$("#modeBadge").textContent=pro?"PRO":"AUTO";toastMsg(pro?"حالت Pro فعال شد":"حالت Auto فعال شد")};

function openPanel(title,html){$("#panelTitle").textContent=title;$("#panelContent").innerHTML=html;$("#panel").hidden=false}
$("#closePanel").onclick=()=>$("#panel").hidden=true;

function quickSetting(kind){
  if(kind==="iso"){
    const i=ISO_VALUES.indexOf(iso);iso=ISO_VALUES[(i+1)%ISO_VALUES.length];$("#isoValue").textContent=iso;
  } else if(kind==="shutter"){
    const i=SHUTTER_VALUES.indexOf(shutter);shutter=SHUTTER_VALUES[(i+1)%SHUTTER_VALUES.length];$("#shutterValue").textContent=shutter;
  } else if(kind==="exposure"){
    ev=ev>=2?-2:Math.round((ev+.5)*10)/10;$("#exposureValue").textContent=(ev>=0?"+":"")+fmt(ev);applyTrackControls();
  } else if(kind==="wb"){const i=WB_VALUES.indexOf(wb);wb=WB_VALUES[(i+1)%WB_VALUES.length];$("#wbValue").textContent=wb}
  else {focus=focus==="AF"?"LOCK":focus==="LOCK"?"CONTINUOUS":"AF";$("#focusValue").textContent=focus}
  toastMsg(kind.toUpperCase()+" تنظیم شد");
}
document.querySelectorAll(".quick-item").forEach(x=>x.onclick=()=>quickSetting(x.dataset.setting));

$("#filterBtn").onclick=()=>openPanel("فیلترهای دوربین",`<div class="choice-row">
${[["none","طبیعی"],["grayscale(1)","سیاه‌وسفید"],["sepia(.65)","سپیا"],["contrast(1.25)","کنتراست"],["saturate(1.5)","Vivid"],["brightness(1.12) saturate(1.25)","روشن"]].map(a=>`<button class="choice ${a[0]===filter?"on":""}" data-filter="${a[0]}">${a[1]}</button>`).join("")}
</div>`);
$("#editBtn").onclick=()=>openPanel("ویرایش سریع",`<div class="setting"><label><span>روشنایی</span><b id="brightV">100%</b></label><input id="bright" type="range" min="70" max="140" value="100"></div>
<div class="setting"><label><span>کنتراست</span><b id="contrastV">100%</b></label><input id="contrast" type="range" min="70" max="140" value="100"></div>
<div class="setting"><label><span>اشباع رنگ</span><b id="satV">100%</b></label><input id="sat" type="range" min="0" max="160" value="100"></div>
<button id="resetEdit" class="save-big">بازنشانی</button>`);
$("#panel").addEventListener("input",e=>{
  if(["bright","contrast","sat"].includes(e.target.id)){
    $("#"+e.target.id+"V").textContent=e.target.value+"%";
    const b=$("#bright")?.value||100,c=$("#contrast")?.value||100,s=$("#sat")?.value||100;
    photo.style.filter=`brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
  }
});
$("#panel").addEventListener("click",e=>{
  if(e.target.dataset.filter){filter=e.target.dataset.filter;video.style.filter=filter;photo.style.filter=filter;$("#panel").hidden=true;toastMsg("فیلتر اعمال شد")}
  if(e.target.id==="resetEdit"){photo.style.filter="none"}
});

$("#settingsBtn").onclick=()=>openPanel("تنظیمات PhotoPro",`
<div class="setting"><label><span>حالت ظاهری</span><b>Liquid</b></label><div class="choice-row"><button id="themeToggle" class="choice">تغییر روشن/تیره</button></div></div>
<div class="setting"><label><span>حالت شب</span><b id="nightState">خاموش</b></label><div class="choice-row"><button id="nightBtn" class="choice">فعال/غیرفعال</button></div></div>
<div class="setting"><label><span>صدای شاتر</span><b id="soundState">روشن</b></label><div class="choice-row"><button id="soundBtn" class="choice">فعال/غیرفعال</button></div></div>
<div class="setting"><label><span>فرمت خروجی</span><b>JPG</b></label><div class="file-note">خروجی عکس با کیفیت بالا و نام‌گذاری خودکار PhotoPro_زمان.jpg</div></div>
<div class="setting"><label><span>دوربین فعلی</span><b>${facing==="environment"?"عقب":"جلو"}</b></label><div class="file-note">قابلیت‌های واقعی مانند ISO و شاتر به پشتیبانی سخت‌افزار و مرورگر دستگاه وابسته‌اند.</div></div>`);

$("#panel").addEventListener("click",e=>{
  if(e.target.id==="themeToggle")document.body.classList.toggle("light");
  if(e.target.id==="nightBtn"){document.body.classList.toggle("night");$("#nightState").textContent=document.body.classList.contains("night")?"روشن":"خاموش"}
  if(e.target.id==="soundBtn"){const b=$("#soundState");b.textContent=b.textContent==="روشن"?"خاموش":"روشن"}
});

$("#galleryBtn").onclick=()=>{$("#galleryStrip").classList.toggle("hidden");renderGallery()};
$("#clearGallery").onclick=()=>{gallery=[];renderGallery();toastMsg("گالری پاک شد")};

function saveToGallery(blob){gallery.unshift({blob,url:URL.createObjectURL(blob),time:new Date().toLocaleTimeString("fa-IR")});gallery=gallery.slice(0,20);renderGallery()}
function renderGallery(){
  const t=$("#thumbs");t.innerHTML="";
  gallery.forEach((g,i)=>{const im=document.createElement("img");im.className="thumb";im.src=g.url;im.title=g.time;im.onclick=()=>{lastBlob=g.blob;photo.src=g.url;photo.hidden=false;video.hidden=true};t.appendChild(im)})
}

$("#saveBtn").onclick=()=>{
  if(!lastBlob){toastMsg("ابتدا عکس بگیرید");return}
  const url=URL.createObjectURL(lastBlob),a=document.createElement("a");
  a.href=url;a.download="PhotoPro_"+new Date().toISOString().replace(/[:.]/g,"-")+".jpg";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  toastMsg("عکس ذخیره شد");
};
$("#fileInput").onchange=e=>{const f=e.target.files?.[0];if(!f)return;lastBlob=f;photo.src=URL.createObjectURL(f);photo.hidden=false;video.hidden=true;setStatus("عکس از گالری انتخاب شد");$("#galleryStrip").classList.remove("hidden");saveToGallery(f)};

let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e});
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
startCamera();