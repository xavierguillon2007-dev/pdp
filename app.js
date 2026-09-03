window.Journal = (() => {
  let client = null;
  const supabaseKey = window.SUPABASE_PUBLISHABLE_KEY || window.SUPABASE_ANON_KEY || "";
  const cfgOk = window.SUPABASE_URL && !window.SUPABASE_URL.includes("TON-PROJET") && supabaseKey && !supabaseKey.includes("TA_CLE");
  if (window.supabase && cfgOk) client = window.supabase.createClient(window.SUPABASE_URL, supabaseKey);

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmt = d => d ? new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(new Date(d)) : "";
  const slug = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const yt = url => {
    if(!url) return null;
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  };
  const demoArticles = [
    {id:"demo1",title:"Bienvenue dans Pen-Seurs de Plaies",slug:"bienvenue-dans-le-journal",excerpt:"Un nouvel espace pour retrouver nos actualités, dossiers, images et vidéos.",content:"<p>Bienvenue dans <strong>Pen-Seurs de Plaies</strong>. Cette démonstration vous montre l’organisation du site.</p>",status:"published",published_at:new Date().toISOString(),cover_image:null,categories:{name:"Actualités"},author:{email:"Rédaction"}},
    {id:"demo2",title:"Un journal pensé pour la lecture",slug:"un-journal-pense-pour-la-lecture",excerpt:"Une présentation claire, des articles confortables à lire et des médias intégrés.",content:"<p>Les articles sont conçus pour une lecture agréable sur ordinateur comme sur téléphone.</p>",status:"published",published_at:new Date(Date.now()-86400000).toISOString(),cover_image:null,categories:{name:"Dossiers"},author:{email:"Rédaction"}}
  ];

  async function getArticles(opts={}) {
    if(!client) return demoArticles;
    let q = client.from("articles").select("*, categories(name)").eq("status","published").order("published_at",{ascending:false});
    if(opts.limit) q=q.limit(opts.limit);
    if(opts.category) q=q.eq("category_id",opts.category);
    const {data,error}=await q;
    if(error){console.error(error);return []} return data||[];
  }
  async function getCategories(){
    if(!client) return [{id:"1",name:"Actualités"},{id:"2",name:"Dossiers"},{id:"3",name:"Interviews"},{id:"4",name:"Vidéos"},{id:"5",name:"À la une"}];
    const {data,error}=await client.from("categories").select("*").order("name");
    return error?[]:(data||[]);
  }
  function card(a){
    return `<article class="article-card"><a href="article.html?id=${encodeURIComponent(a.id)}"><div class="${a.cover_image?'':'no-img'}">${a.cover_image?`<img src="${esc(a.cover_image)}" alt="">`:''}</div><div class="body"><span class="tag">${esc(a.categories?.name||"Actualités")}</span><h3>${esc(a.title)}</h3><p>${esc(a.excerpt||"")}</p><div class="meta"><span>${fmt(a.published_at)}</span><span>Lire →</span></div></div></a></article>`;
  }
  async function home(){
    const articles=await getArticles({limit:5});
    const featured=document.getElementById("featured"), latest=document.getElementById("latest");
    if(articles.length){
      const a=articles[0];
      featured.innerHTML=`<div class="hero-content"><span class="eyebrow">À la une</span><h1>${esc(a.title)}</h1><p>${esc(a.excerpt||"Découvrez notre dernier article.")}</p><a class="btn btn-light" href="article.html?id=${encodeURIComponent(a.id)}">Lire l’article →</a><div class="meta" style="justify-content:flex-start;gap:20px;color:#d7edf3;margin-top:25px">${fmt(a.published_at)}</div></div>${a.cover_image?`<img class="hero-image" src="${esc(a.cover_image)}" alt="">`: '<div class="hero-image empty-img"></div>'}`;
      latest.innerHTML=articles.slice(0,4).map(card).join("");
    } else document.getElementById("emptyState").hidden=false;
    const cats=await getCategories(); document.getElementById("categories").innerHTML=cats.map(c=>`<a class="category" href="articles.html?category=${encodeURIComponent(c.id)}">${esc(c.name)}<span>Explorer →</span></a>`).join("");
  }
  async function listPage(){
    const all=await getArticles(); const cats=await getCategories();
    const select=document.getElementById("category"), params=new URLSearchParams(location.search), wanted=params.get("category");
    cats.forEach(c=>select.insertAdjacentHTML("beforeend",`<option value="${esc(c.id)}">${esc(c.name)}</option>`));
    if(wanted && wanted!=="all") select.value=wanted;
    const render=()=>{
      const term=document.getElementById("search").value.toLowerCase().trim(), cat=select.value;
      const arr=all.filter(a=>(!term || `${a.title} ${a.excerpt||""}`.toLowerCase().includes(term)) && (!cat || cat==="all" || a.category_id===cat));
      document.getElementById("articles").innerHTML=arr.map(card).join(""); document.getElementById("empty").hidden=arr.length>0;
    };
    document.getElementById("search").addEventListener("input",render); select.addEventListener("change",render); render();
  }
  async function readArticle(){
    const id=new URLSearchParams(location.search).get("id"); let a=null;
    if(client){ const r=await client.from("articles").select("*, categories(name)").eq("id",id).single(); a=r.data; }
    else a=demoArticles.find(x=>x.id===id)||demoArticles[0];
    if(!a){document.getElementById("article").innerHTML="<div class='empty'>Article introuvable.</div>";return}
    document.title=`${a.title} — Pen-Seurs de Plaies`;
    const embed=yt(a.youtube_url||a.youtube);
    document.getElementById("article").innerHTML=`<div class="article-head"><span class="tag">${esc(a.categories?.name||"Actualités")}</span><h1>${esc(a.title)}</h1><div class="muted">${fmt(a.published_at)}</div></div>${a.cover_image?`<img class="article-cover" src="${esc(a.cover_image)}" alt="">`:''}<div class="article-content">${a.content||""}${embed?`<div class="youtube-wrap"><iframe src="${embed}" title="Vidéo YouTube" allowfullscreen></iframe></div>`:''}</div>`;
  }
  async function currentUser(){
    if(!client)return null;
    try{
      // getSession() lit la session persistée localement et évite de dépendre
      // d'un nouvel appel réseau juste pour savoir si le visiteur est connecté.
      const {data,error}=await client.auth.getSession();
      if(error){console.warn("Impossible de récupérer la session :",error);return null;}
      return data?.session?.user||null;
    }catch(e){
      console.warn("Impossible de récupérer la session :",e);
      return null;
    }
  }
  async function isAdmin(userId=null){
    if(!client)return false;
    const id=userId || (await currentUser())?.id;
    if(!id)return false;
    try{
      const {data,error}=await client.from("admin_users").select("user_id").eq("user_id",id).maybeSingle();
      if(error){console.warn("Vérification du statut administrateur impossible :",error);return false;}
      return !!data;
    }catch(e){console.warn("Vérification du statut administrateur impossible :",e);return false;}
  }
  async function isWriter(userId=null){
    const id=userId || (await currentUser())?.id;
    if(!id || !client)return false;
    if(await isAdmin(id)) return true;
    try{
      const {data,error}=await client.from("member_profiles").select("role,status").eq("user_id",id).maybeSingle();
      if(error){console.warn("Vérification du rôle rédacteur impossible :",error);return false;}
      return data?.status === "approved" && data?.role === "writer";
    }catch(e){console.warn("Vérification du rôle rédacteur impossible :",e);return false;}
  }


  function installAuthUI(){
    if(!client)return;
    const apply=async(session)=>{
      const user=session?.user||null;
      document.querySelectorAll(".nav-actions").forEach(actions=>{
        const loginLinks=actions.querySelectorAll('a[href="login.html"],a[href="signup.html"]');
        const oldLogout=actions.querySelector(".logout-link");

        const oldCreate=actions.querySelector(".create-article-link");
        if(oldCreate) oldCreate.remove();

        if(user){
          loginLinks.forEach(x=>x.remove());
          if(!oldLogout){
            const logout=document.createElement("a");
            logout.href="#";
            logout.className="btn btn-outline logout-link";
            logout.textContent="Se déconnecter";
            logout.addEventListener("click",async e=>{
              e.preventDefault();
              logout.textContent="Déconnexion…";
              const {error}=await client.auth.signOut();
              if(error){
                console.error(error);
                logout.textContent="Se déconnecter";
                return;
              }
              location.href="index.html";
            });
            actions.insertBefore(logout,actions.firstChild);
          }

          // Seuls les rédacteurs et les administrateurs voient l'accès à l'écriture.
          if(!document.body.contains(actions)) return;
          isWriter(user.id).then(writer=>{
            if(!writer || actions.querySelector(".create-article-link")) return;
            const create=document.createElement("a");
            create.href="write.html";
            create.className="btn btn-dark create-article-link";
            create.textContent="Créer un article";
            actions.insertBefore(create,actions.firstChild);
          });
        }else{
          if(oldLogout)oldLogout.remove();
          if(!actions.querySelector('a[href="login.html"]')){
            const login=document.createElement("a");
            login.className="btn btn-outline";
            login.href="login.html";
            login.textContent="Se connecter";
            actions.insertBefore(login,actions.firstChild);
          }
        }
      });
    };

    // Affichage immédiat à partir de la session locale.
    client.auth.getSession().then(({data})=>apply(data?.session||null));

    // Puis synchronisation automatique après connexion, déconnexion ou
    // renouvellement de session. Cela évite que la page reste affichée comme
    // visiteur alors que Supabase considère bien l'utilisateur connecté.
    client.auth.onAuthStateChange((_event,session)=>{
      window.setTimeout(()=>apply(session||null),0);
    });
  }

  async function showAdminLink(){
    // Conservé pour compatibilité avec d'anciennes pages : aucun lien
    // « Espace admin » n'est jamais ajouté au site public.
    installAuthUI();
  }
  function authErrorMessage(error){
    const m=String(error?.message||error||"");
    if(m.toLowerCase().includes("email not confirmed")) return "Ton adresse e-mail n’est pas encore confirmée. Vérifie ta boîte mail, puis réessaie.";
    if(m.toLowerCase().includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
    if(m.toLowerCase().includes("email rate limit")) return "Trop de tentatives. Attends quelques instants avant de réessayer.";
    return m || "Une erreur est survenue.";
  }
  async function login(){
    const form=document.getElementById("loginForm"); if(!form)return;
    if(!client){document.getElementById("loginMsg").textContent="Configure d’abord config.js avec l’URL et la Publishable key de ton projet Supabase.";return}
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      const msg=document.getElementById("loginMsg");
      msg.textContent="Connexion…";
      const emailValue=document.getElementById("email").value.trim();
      const passwordValue=document.getElementById("password").value;
      const {data,error}=await client.auth.signInWithPassword({email:emailValue,password:passwordValue});
      if(error){msg.textContent=authErrorMessage(error);return}
      const user=data?.user;
      if(!user){msg.textContent="Connexion impossible : aucun utilisateur n’a été retourné par Supabase.";return}

      // La session est déjà persistée par Supabase. On vérifie simplement
      // l'admin pour choisir la destination, sans empêcher un membre normal
      // de se connecter si cette vérification rencontre momentanément une erreur.
      const admin=await isAdmin(user.id);
      msg.textContent=admin?"Connexion administrateur réussie !":"Connexion réussie !";
      window.location.replace(admin?"admin.html":"index.html");
    });
  }
  async function signup(){
    const form=document.getElementById("signupForm"); if(!form)return;
    if(!client){document.getElementById("signupMsg").textContent="Configure d’abord config.js avec l’URL et la Publishable key de ton projet Supabase.";return}
    form.addEventListener("submit",async e=>{
      e.preventDefault(); const msg=document.getElementById("signupMsg"); msg.textContent="Création du compte…";
      const firstName=document.getElementById("firstName").value.trim();
      const lastName=document.getElementById("lastName").value.trim();
      const emailValue=document.getElementById("signupEmail").value.trim();
      const password=document.getElementById("signupPassword").value;
      const password2=document.getElementById("signupPassword2").value;
      if(password!==password2){msg.textContent="Les deux mots de passe ne correspondent pas.";return}
      const {data,error}=await client.auth.signUp({
        email:emailValue, password,
        options:{
          data:{first_name:firstName,last_name:lastName}
        }
      });
      if(error){msg.textContent=authErrorMessage(error);return}
      if(data.session){
        msg.textContent="Compte créé ! Redirection…";
        location.href="index.html";
      }else{
        msg.textContent="Compte créé ! Tu peux maintenant te connecter.";
        form.reset();
      }
    });
  }
  async function admin(){
    if(!client){document.getElementById("adminMessage").textContent="Configure config.js avec les clés Supabase avant d’utiliser l’administration.";return}
    if(!(await isAdmin())){location.href="login.html";return}
    document.getElementById("logout").onclick=async e=>{e.preventDefault();await client.auth.signOut();location.href="index.html"};
    await loadAdminData(); await loadCategoriesEditor(); await loadAccounts();
    document.getElementById("articleForm").addEventListener("submit",saveArticle);
    setupRichEditor();
    document.getElementById("cover").addEventListener("change",e=>{const f=e.target.files[0];if(f)document.getElementById("coverPreview").innerHTML=`<img src="${URL.createObjectURL(f)}" alt="">`});
  }
  async function writer(){
    if(!client){const m=document.getElementById("writerMessage");if(m)m.textContent="Configure config.js avec les clés Supabase avant d’utiliser l’écriture.";return}
    if(!(await isWriter())){location.href="login.html";return}
    const form=document.getElementById("articleForm");
    if(!form)return;
    await loadCategoriesEditor();
    await loadWriterArticles();
    form.addEventListener("submit",saveArticle);
    setupRichEditor();
    const cover=document.getElementById("cover");
    if(cover) cover.addEventListener("change",e=>{const f=e.target.files[0];if(f)document.getElementById("coverPreview").innerHTML=`<img src="${URL.createObjectURL(f)}" alt="">`});
    const id=new URLSearchParams(location.search).get("id");
    if(id) await editArticle(id);
  }
  async function loadWriterArticles(){
    const tbody=document.getElementById("writerArticles");
    if(!tbody)return;
    const {data,error}=await client.from("articles").select("id,title,status,published_at,categories(name)").order("created_at",{ascending:false});
    if(error){tbody.innerHTML=`<tr><td colspan="5">${esc(error.message)}</td></tr>`;return}
    const arr=data||[];
    tbody.innerHTML=arr.map(x=>`<tr><td><b>${esc(x.title)}</b></td><td>${esc(x.categories?.name||"—")}</td><td><span class="status ${x.status==="draft"?"draft":""}">${x.status==="published"?"Publié":"Brouillon"}</span></td><td>${fmt(x.published_at)}</td><td class="actions"><a class="icon-btn" href="article.html?id=${x.id}" target="_blank">Voir</a><button class="icon-btn" onclick="Journal.editArticle('${x.id}')">Modifier</button></td></tr>`).join("") || `<tr><td colspan="5">Aucun article pour le moment.</td></tr>`;
  }
  async function loadCategoriesEditor(){
    const cats=await getCategories(); const s=document.getElementById("categoryEdit"); s.innerHTML=cats.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    const statCategories=document.getElementById("statCategories"); if(statCategories) statCategories.textContent=cats.length;
  }
  async function loadAdminData(){
    const {data,error}=await client.from("articles").select("id,title,status,published_at,category_id,categories(name)").order("created_at",{ascending:false});
    if(error){document.getElementById("adminMessage").textContent=error.message;return}
    const arr=data||[]; document.getElementById("statPublished").textContent=arr.filter(a=>a.status==="published").length; document.getElementById("statDrafts").textContent=arr.filter(a=>a.status==="draft").length;
    document.getElementById("adminArticles").innerHTML=arr.map(a=>`<tr><td><b>${esc(a.title)}</b></td><td>${esc(a.categories?.name||"—")}</td><td><span class="status ${a.status==="draft"?"draft":""}">${a.status==="published"?"Publié":"Brouillon"}</span></td><td>${fmt(a.published_at)}</td><td class="actions"><a class="icon-btn" href="article.html?id=${a.id}" target="_blank">Voir</a><button class="icon-btn" onclick="Journal.editArticle('${a.id}')">Modifier</button><button class="icon-btn" onclick="Journal.deleteArticle('${a.id}')">Suppr.</button></td></tr>`).join("");
  }
  async function loadAccounts(){
    const tbody=document.getElementById("adminAccounts");
    if(!tbody) return;
    const {data,error}=await client.from("member_profiles").select("user_id,first_name,last_name,email,status,role,created_at,updated_at").order("created_at",{ascending:false});
    if(error){
      tbody.innerHTML=`<tr><td colspan="6">${esc(error.message)}</td></tr>`;
      return;
    }
    const rows=data||[];
    const pending=rows.filter(x=>x.status==="pending").length;
    const approved=rows.filter(x=>x.status==="approved").length;
    const rejected=rows.filter(x=>x.status==="rejected").length;
    const count=document.getElementById("statAccounts"); if(count) count.textContent=rows.length;
    const pendingCount=document.getElementById("pendingAccountsCount"); if(pendingCount) pendingCount.textContent=pending;
    tbody.innerHTML=rows.map(a=>{
      const label=a.status==="approved"?"Accepté":a.status==="rejected"?"Refusé":"En attente";
      const cls=a.status==="approved"?"":"draft";
      return `<tr><td><b>${esc((a.first_name||"")+" "+(a.last_name||"")).trim()||"—"}</b></td><td>${esc(a.email||"—")}</td><td><span class="status ${cls}">${label}</span></td><td><select class="role-select" onchange="Journal.setAccountRole('${a.user_id}',this.value)" ${a.status!=="approved"?"disabled":""}><option value="member" ${a.role!=="writer"?"selected":""}>Membre</option><option value="writer" ${a.role==="writer"?"selected":""}>Rédacteur</option></select></td><td>${fmt(a.created_at)}</td><td class="actions"><button class="icon-btn" onclick="Journal.editAccount('${a.user_id}')">Modifier</button>${a.status!=="approved"?`<button class="icon-btn" onclick="Journal.setAccountStatus('${a.user_id}','approved')">Accepter</button>`:""}${a.status!=="rejected"?`<button class="icon-btn" onclick="Journal.setAccountStatus('${a.user_id}','rejected')">Refuser</button>`:""}${a.status!=="pending"?`<button class="icon-btn" onclick="Journal.setAccountStatus('${a.user_id}','pending')">En attente</button>`:""}<button class="icon-btn" onclick="Journal.deleteAccount('${a.user_id}')">Supprimer</button></td></tr>`;
    }).join("");
    const summary=document.getElementById("accountsSummary"); if(summary) summary.textContent=`${pending} en attente · ${approved} accepté(s) · ${rejected} refusé(s)`;
  }
  async function editAccount(userId){
    const {data,error}=await client.from("member_profiles").select("user_id,first_name,last_name,email,status").eq("user_id",userId).single();
    if(error){alert(error.message);return}
    const first=prompt("Prénom :",data.first_name||""); if(first===null)return;
    const last=prompt("Nom :",data.last_name||""); if(last===null)return;
    const {error:updateError}=await client.from("member_profiles").update({first_name:first.trim(),last_name:last.trim(),updated_at:new Date().toISOString()}).eq("user_id",userId);
    if(updateError){alert(updateError.message);return}
    await loadAccounts();
  }
  async function setAccountStatus(userId,status){
    const labels={approved:"accepter",rejected:"refuser",pending:"remettre en attente"};
    if(!confirm(`Voulez-vous ${labels[status]} ce compte ?`))return;
    const {error}=await client.from("member_profiles").update({status,updated_at:new Date().toISOString()}).eq("user_id",userId);
    if(error){alert(error.message);return}
    await loadAccounts();
  }
  async function setAccountRole(userId,role){
    if(role!=="member" && role!=="writer") return;
    const {data,error}=await client.from("member_profiles").select("status").eq("user_id",userId).single();
    if(error){alert(error.message);return}
    if(data.status!=="approved") return;
    const r=await client.from("member_profiles").update({role,updated_at:new Date().toISOString()}).eq("user_id",userId);
    if(r.error) alert(r.error.message); else await loadAccounts();
  }
  async function deleteAccount(userId){
    if(!confirm("Supprimer définitivement ce compte ? Cette action supprimera également son accès à la connexion."))return;
    const {error}=await client.rpc("admin_delete_user",{target_user_id:userId});
    if(error){alert(error.message);return}
    await loadAccounts();
  }

  async function compressImage(file){
    if(!file || !file.type.startsWith("image/")) throw new Error("Le fichier sélectionné n’est pas une image.");
    const MAX_DIM=1800;
    const TARGET_BYTES=900*1024;
    const img=await new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error("Impossible de lire cette image."));
      image.src=URL.createObjectURL(file);
    });
    const ratio=Math.min(1,MAX_DIM/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
    const ctx=canvas.getContext("2d");
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    URL.revokeObjectURL(img.src);

    let quality=0.82;
    let blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality));
    while(blob && blob.size>TARGET_BYTES && quality>0.5){
      quality-=0.07;
      blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality));
    }
    if(!blob) throw new Error("La compression de l’image a échoué.");
    return blob;
  }

  function setupRichEditor(){
    const editor=document.getElementById("contentEditor");
    if(!editor || editor.dataset.ready) return;
    editor.dataset.ready="1";
    const wrap=document.getElementById("richEditorWrap");
    wrap.querySelectorAll("[data-command]").forEach(btn=>btn.addEventListener("mousedown",e=>e.preventDefault()));
    wrap.querySelectorAll("[data-command]").forEach(btn=>btn.addEventListener("click",()=>{
      editor.focus(); document.execCommand(btn.dataset.command,false,null); syncEditorSource();
    }));
    document.getElementById("formatBlock").addEventListener("change",e=>{
      editor.focus(); document.execCommand("formatBlock",false,e.target.value); syncEditorSource(); e.target.value="p";
    });
    document.getElementById("insertLink").addEventListener("mousedown",e=>e.preventDefault());
    document.getElementById("insertLink").addEventListener("click",()=>{
      editor.focus();
      const url=prompt("Adresse du lien (https://...) :");
      if(url){ document.execCommand("createLink",false,url); syncEditorSource(); }
    });

    const imageButton=document.getElementById("insertImage");
    const imageInput=document.getElementById("inlineImageInput");
    let savedRange=null;
    imageButton.addEventListener("mousedown",e=>{
      e.preventDefault();
      const sel=window.getSelection();
      if(sel && sel.rangeCount && editor.contains(sel.anchorNode)){
        savedRange=sel.getRangeAt(0).cloneRange();
      }
    });
    imageButton.addEventListener("click",()=>imageInput.click());
    imageInput.addEventListener("change",async()=>{
      const file=imageInput.files[0];
      imageInput.value="";
      if(!file)return;
      try{
        const caption=prompt("Légende de l’image (facultatif) :","");
        const status=document.getElementById("uploadStatus");
        if(status) status.textContent="Compression et envoi de l’image…";
        const compressed=await compressImage(file);
        const path=`inline/${crypto.randomUUID()}.webp`;
        const up=await client.storage.from("journal").upload(path,compressed,{upsert:false,contentType:"image/webp"});
        if(up.error) throw up.error;
        const publicUrl=client.storage.from("journal").getPublicUrl(path).data.publicUrl;
        const figure=document.createElement("figure");
        figure.className="article-inline-image";
        const img=document.createElement("img");
        img.src=publicUrl;
        img.alt=caption || "";
        figure.appendChild(img);
        if(caption && caption.trim()){
          const figcaption=document.createElement("figcaption");
          figcaption.textContent=caption.trim();
          figure.appendChild(figcaption);
        }
        editor.focus();
        const sel=window.getSelection();
        if(savedRange){
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }
        if(sel && sel.rangeCount){
          const range=sel.getRangeAt(0);
          range.collapse(false);
          range.insertNode(figure);
          const spacer=document.createElement("p");
          spacer.innerHTML="<br>";
          figure.after(spacer);
          const newRange=document.createRange();
          newRange.setStart(spacer,0); newRange.collapse(true);
          sel.removeAllRanges(); sel.addRange(newRange);
        }else{
          editor.appendChild(figure);
        }
        syncEditorSource();
        if(status) status.textContent=`Image ajoutée : ${Math.round(file.size/1024)} Ko → ${Math.round(compressed.size/1024)} Ko`;
      }catch(err){
        alert("Impossible d’ajouter l’image : "+(err.message||err));
        const status=document.getElementById("uploadStatus");
        if(status) status.textContent="";
      }
    });

    editor.addEventListener("input",syncEditorSource);
    editor.addEventListener("paste",()=>setTimeout(syncEditorSource,0));
  }
  function syncEditorSource(){const editor=document.getElementById("contentEditor"),source=document.getElementById("content");if(editor&&source)source.value=editor.innerHTML;}
  function getEditorContent(){syncEditorSource();return document.getElementById("content").value.trim();}
  function setEditorContent(html){const editor=document.getElementById("contentEditor"),source=document.getElementById("content");if(editor)editor.innerHTML=html||"";if(source)source.value=html||"";}

  async function saveArticle(e){
    e.preventDefault();
    const clicked=e.submitter;
    if(clicked?.dataset.saveStatus) document.getElementById("status").value=clicked.dataset.saveStatus; const id=document.getElementById("articleId").value; const title=document.getElementById("title").value.trim();
    let cover_image=document.getElementById("coverPreview").dataset.url||null; const file=document.getElementById("cover").files[0];
    if(file){
      const status=document.getElementById("uploadStatus");
      if(status) status.textContent="Compression de l’image…";
      let compressed;
      try{ compressed=await compressImage(file); }catch(err){ alert(err.message); if(status) status.textContent=""; return; }
      if(status) status.textContent=`Image compressée : ${Math.round(file.size/1024)} Ko → ${Math.round(compressed.size/1024)} Ko`;
      const path=`covers/${crypto.randomUUID()}.webp`;
      const up=await client.storage.from("journal").upload(path,compressed,{upsert:false,contentType:"image/webp"});
      if(up.error){alert(up.error.message);if(status) status.textContent="";return}
      const pub=client.storage.from("journal").getPublicUrl(path);cover_image=pub.data.publicUrl;
    }
    const obj={title,slug:slug(title)+"-"+Date.now(),excerpt:document.getElementById("excerpt").value,content:getEditorContent(),youtube_url:document.getElementById("youtube").value||null,cover_image,category_id:document.getElementById("categoryEdit").value,status:document.getElementById("status").value,published_at:document.getElementById("publishedAt").value?new Date(document.getElementById("publishedAt").value).toISOString():new Date().toISOString()};
    if(!id){ const u=await currentUser(); if(u) obj.author_id=u.id; }
    let r=id?await client.from("articles").update(obj).eq("id",id):await client.from("articles").insert(obj);
    if(r.error){alert(r.error.message);return} alert("Article enregistré."); clearEditor(); if(document.getElementById("adminArticles")) await loadAdminData(); if(document.getElementById("writerArticles")) await loadWriterArticles();
  }
  async function editArticle(id){
    const {data,error}=await client.from("articles").select("*").eq("id",id).single(); if(error)return alert(error.message);
    document.getElementById("articleId").value=data.id;document.getElementById("title").value=data.title;document.getElementById("excerpt").value=data.excerpt||"";setEditorContent(data.content||"");document.getElementById("youtube").value=data.youtube_url||"";document.getElementById("categoryEdit").value=data.category_id||"";document.getElementById("status").value=data.status;document.getElementById("publishedAt").value=data.published_at?new Date(data.published_at).toISOString().slice(0,16):"";
    document.getElementById("coverPreview").dataset.url=data.cover_image||"";document.getElementById("coverPreview").innerHTML=data.cover_image?`<img src="${esc(data.cover_image)}" alt="">`:"";document.getElementById("editorTitle").textContent="Modifier l’article";document.getElementById("editor").scrollIntoView({behavior:"smooth"});
  }
  async function deleteArticle(id){if(!confirm("Supprimer définitivement cet article ?"))return;const {error}=await client.from("articles").delete().eq("id",id);if(error)alert(error.message);else loadAdminData()}
  function clearEditor(){document.getElementById("articleForm").reset();document.getElementById("articleId").value="";setEditorContent("");document.getElementById("coverPreview").innerHTML="";document.getElementById("coverPreview").dataset.url="";document.getElementById("uploadStatus").textContent="";document.getElementById("editorTitle").textContent="Nouvel article"}
  return {home,listPage,readArticle,login,signup,admin,writer,editArticle,deleteArticle,clearEditor,newArticle:clearEditor,showAdminLink,editAccount,setAccountStatus,setAccountRole,deleteAccount,setupPublicNavigation,submitContact};

  function setupPublicNavigation(){
    document.querySelectorAll('.mobile-menu').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const header=btn.closest('.site-header'); if(!header)return;
        const open=header.classList.toggle('mobile-nav-open');
        btn.setAttribute('aria-expanded',String(open));
      });
    });
  }
  function submitContact(event){
    event.preventDefault();
    const form=event.currentTarget;
    const name=form.name.value.trim(), email=form.email.value.trim(), subject=form.subject.value.trim(), message=form.message.value.trim();
    const body=`Nom : ${name}\nE-mail : ${email}\n\n${message}`;
    const target='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    const msg=document.getElementById('contactMsg');
    if(msg) msg.textContent='Votre logiciel de messagerie va s’ouvrir pour envoyer le message.';
    window.location.href=target;
    return false;
  }
})();
document.addEventListener("DOMContentLoaded",()=>{Journal.showAdminLink();Journal.setupPublicNavigation();});
