/* Smoke tests do app real em Chromium, com mock explícito do Supabase.
   Não usa credenciais de assinantes nem modifica o banco de staging. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=fs.readFileSync(path.join(root,'tests/mock-supabase-browser.js'),'utf8');
const mime={'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname).replace(/^\/+/,'')||'index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403);res.end();return}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);res.end();return}
    res.writeHead(200,{'content-type':(mime[path.extname(file)]||'application/octet-stream')+'; charset=utf-8'});
    res.end(data);
  });
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const origin='http://127.0.0.1:'+port+'/index.html';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let failures=0;

async function abrir(perfil,width=1440){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage(),erros=[];
  page.on('pageerror',e=>erros.push(e.message));
  await page.route('**/js/vendor/supabase.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:fixture}));
  const query='?perfil='+perfil+(perfil==='convidado'?'&convite=30000000-0000-4000-8000-000000000999':'');
  await page.goto(origin+query,{waitUntil:'load'});
  const pin=page.locator('#form-criar-pin');
  await Promise.race([
    pin.waitFor({state:'visible',timeout:12000}).catch(()=>{}),
    page.locator('#topbar:not([hidden])').waitFor({state:'visible',timeout:12000}).catch(()=>{})
  ]);
  if(await pin.isVisible()){
    await pin.locator('[name="pin"]').fill('1234');
    await pin.locator('[name="confirmacao"]').fill('1234');
    await pin.locator('[type="submit"]').click();
  }
  await page.locator('#topbar:not([hidden])').waitFor({timeout:12000});
  return {page,context,erros};
}
async function run(nome,fn){
  try{await fn();console.log('PASS: '+nome)}
  catch(e){failures++;console.error('FAIL: '+nome+'\n'+e.stack)}
}
try{
  await run('proprietário: primeiro acesso, equipe, horários, convite, agenda e celular',async()=>{
    const {page,context,erros}=await abrir('dono');
    try{
      await page.goto(origin+'?perfil=dono#/equipe');
      await page.locator('h1:has-text("Equipe e Profissionais")').waitFor();
      await page.locator('[data-novo-prof]').click();
      await page.locator('.sheet input[name="nome"]').fill('Camila');
      await page.locator('.sheet [data-add-ausencia]').click();
      assert.ok((await page.locator('#toast-root').innerText()).includes('data'),'Deve validar data ausente.');
      await page.locator('.sheet [name="ausenciaInicioData"]').fill('2027-05-01');
      await page.locator('.sheet [name="ausenciaFimData"]').fill('2027-05-10');
      await page.locator('.sheet [name="ausenciaTipo"]').selectOption('ferias');
      await page.locator('.sheet [data-add-ausencia]').click();
      assert.equal(await page.locator('.sheet [data-rm-ausencia]').count(),1);
      await page.locator('.sheet [type="submit"]').click();
      await page.locator('#lista-profissionais').getByText('Camila').waitFor();
      await page.waitForFunction(()=>window.__admproMock.rows.some(r=>r.colecao==='profissionais'&&r.dados.nome==='Camila'));
      const prof=await page.evaluate(()=>window.__admproMock.rows.find(r=>r.colecao==='profissionais'&&r.dados.nome==='Camila').dados);
      assert.equal(prof.ausencias[0].dataFim,'2027-05-10');
      assert.equal(prof.horariosSemana.length,7);

      await page.locator('[data-convidar]').click();
      await page.locator('.sheet [name="email"]').fill('convite@example.test');
      await page.locator('.sheet [name="papel"]').selectOption('profissional');
      await page.locator('.sheet [name="profissionalId"]').selectOption('prof-ana');
      await page.locator('.sheet [type="submit"]').click();
      await page.locator('#link-convite').waitFor();
      assert.ok((await page.locator('#link-convite').inputValue()).includes('convite='));

      await page.goto(origin+'?perfil=dono#/agenda');
      await page.locator('#agenda-profissional').waitFor();
      assert.ok(await page.locator('.agenda-coluna').count()>=2,'Agenda geral deve ter colunas.');
      await page.locator('#agenda-profissional').selectOption('prof-ana');
      await page.locator('.agenda-slot').first().waitFor();
      await page.setViewportSize({width:390,height:844});
      const dimension=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
      assert.ok(dimension.scroll<=dimension.width+2,
        'Rolagem horizontal no celular: '+JSON.stringify(dimension));
      assert.deepEqual(erros,[],'Erros JS durante navegação');
    }finally{await context.close()}
  });

  await run('profissional: PIN independente, agenda própria, rotas restritas',async()=>{
    const {page,context,erros}=await abrir('profissional',390);
    try{
      await page.goto(origin+'?perfil=profissional#/agenda');
      await page.locator('h1:has-text("Agenda")').waitFor();
      assert.equal(await page.locator('#agenda-profissional').count(),0,'Profissional não precisa do seletor global.');
      assert.equal(await page.locator('.agenda-item').count(),1,'Só pode consultar agendamentos próprios.');
      await page.goto(origin+'?perfil=profissional#/financeiro');
      await page.getByText('Acesso restrito').waitFor();
      await page.goto(origin+'?perfil=profissional#/equipe');
      await page.getByText('Acesso restrito').waitFor();
      assert.deepEqual(erros,[],'Erros JS durante navegação profissional');
    }finally{await context.close()}
  });

  await run('convidado: aceite vincula à empresa sem criar conta paralela',async()=>{
    const {page,context,erros}=await abrir('convidado',390);
    try{
      const aceito=await page.evaluate(()=>window.__admproMock.conviteAceito);
      assert.equal(aceito,true,'Convite autenticado deveria ser aceito.');
      const vinculos=await page.evaluate(()=>window.AdmPro.auth.contas.map(c=>c.nome_negocio));
      assert.equal(vinculos.length,1);
      assert.equal(vinculos[0],'Estúdio Principal');
      assert.ok(!new URL(page.url()).searchParams.has('convite'),'URL deve remover convite utilizado.');
      await page.goto(origin+'?perfil=convidado#/agenda');
      await page.locator('h1:has-text("Agenda")').waitFor();
      await page.goto(origin+'?perfil=convidado#/financeiro');
      await page.getByText('Acesso restrito').waitFor();
      assert.deepEqual(erros,[]);
    }finally{await context.close()}
  });

  await run('mesmo usuário: alterna empresa sem misturar clientes',async()=>{
    const {page,context,erros}=await abrir('duas');
    try{
      await page.goto(origin+'?perfil=duas#/empresas');
      await page.locator('[data-empresa]').first().waitFor();
      assert.equal(await page.locator('[data-empresa]').count(),2);
      await page.locator('[data-empresa="10000000-0000-4000-8000-000000000002"]').click();
      // A proteção PIN é independente por empresa neste navegador: no primeiro
      // acesso à segunda empresa, configuramos o PIN antes de seguir.
      await page.waitForFunction(()=>!!document.querySelector('#form-criar-pin')||
        !!document.querySelector('.topbar-nome')?.textContent?.includes('Estúdio Secundário'),null,{timeout:12000});
      if(await page.locator('#form-criar-pin').isVisible()){
        await page.locator('#form-criar-pin [name="pin"]').fill('5678');
        await page.locator('#form-criar-pin [name="confirmacao"]').fill('5678');
        await page.locator('#form-criar-pin [type="submit"]').click();
      }
      await page.locator('.topbar-nome:has-text("Estúdio Secundário")').waitFor({timeout:12000});
      const clientes=await page.evaluate(()=>window.AdmPro.storage.lista('clientes').map(c=>c.nome));
      assert.ok(clientes.includes('Cliente Secundário'));
      assert.ok(!clientes.includes('Cliente Ana'),'Cache não pode trazer clientes da outra empresa.');
      assert.deepEqual(erros,[],'Erros JS durante troca de empresa');
    }finally{await context.close()}
  });
  await run('recepção: recebimento seguro atualiza serviço e registra receita uma vez',async()=>{
    const {page,context,erros}=await abrir('recepcao',390);
    try{
      await page.goto(origin+'?perfil=recepcao#/servicos/atend-recepcao');
      await page.locator('button[data-pagar="parcela-recepcao"]').waitFor();
      await page.locator('button[data-pagar="parcela-recepcao"]').click();
      await page.locator('#form-pagamento [name="formaPagamento"]').selectOption('pix');
      await page.locator('#form-pagamento [type="submit"]').click();
      await page.waitForFunction(()=>{
        const m=window.__admproMock;
        return m.rows.find(x=>x.id==='atend-recepcao')?.dados.parcelas?.[0]?.pago===true;
      });
      const estado=await page.evaluate(()=>{
        const rs=window.__admproMock.rows;
        return {servico:rs.find(x=>x.id==='atend-recepcao')?.dados,
          receitas:rs.filter(x=>x.colecao==='lancamentos'&&x.dados.servicoId==='atend-recepcao')};
      });
      assert.equal(estado.servico.status,'pago');
      assert.equal(estado.receitas.length,1);
      assert.equal(estado.receitas[0].dados.valor,80);
      assert.equal(await page.locator('[data-estornar]').count(),0,'Recepção não pode estornar sem permissão financeira.');
      await page.goto(origin+'?perfil=recepcao#/financeiro');
      await page.getByText('Acesso restrito').waitFor();
      assert.deepEqual(erros,[]);
    }finally{await context.close()}
  });

  await run('revogação ao reconectar limpa empresa e bloqueia dados antigos',async()=>{
    const {page,context,erros}=await abrir('dono',390);
    try{
      await page.goto(origin+'?perfil=dono#/clientes');
      await page.getByText('Cliente Ana').first().waitFor();
      await context.setOffline(true);
      await page.evaluate(()=>window.__admproMock.revogar());
      await context.setOffline(false);
      await page.evaluate(()=>window.dispatchEvent(new Event('online')));
      await page.getByText('Nenhuma empresa vinculada.').waitFor({timeout:12000});
      const estado=await page.evaluate(()=>({
        conta:window.AdmPro.auth.conta,
        clientes:window.AdmPro.storage.lista('clientes'),
        keys:Object.keys(localStorage).filter(k=>k.includes('10000000-0000-4000-8000-000000000001'))
      }));
      assert.equal(estado.conta,null);
      assert.equal(estado.clientes.length,0);
      assert.equal(estado.keys.length,0,'Cache revogado precisa ser apagado.');
      assert.deepEqual(erros,[]);
    }finally{await context.close()}
  });

  await run('visual: contrastes, espaçamentos e largura dos temas claro, escuro e automático',async()=>{
    const {page,context,erros}=await abrir('dono',390);
    try{
      await page.goto(origin+'?perfil=dono#/equipe');
      await page.locator('h1:has-text("Equipe e Profissionais")').waitFor();
      await page.evaluate(()=>{
        const box=document.createElement('section');
        box.id='visual-fixture';
        box.innerHTML='<div class="admpro-banner alerta">Assinatura atrasada. <a href="#/assinatura">Pagar</a></div>'+
          '<div class="admpro-aviso alerta">Aviso de segurança</div>'+
          '<div class="resposta-suporte">Resposta enviada pelo suporte.</div>'+
          '<article class="card"><button class="btn ghost" type="button">Ação discreta</button>'+
          '<button class="btn perigo" type="button">Ação perigosa</button></article>';
        document.getElementById('conteudo').append(box);
        window.AdmPro.ui.toastAcao('Atualização disponível','Atualizar',()=>{});
      });
      const contrast=(a,b)=>{
        const rgb=s=>(s.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
        const lum=c=>{
          const q=rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
          return .2126*q[0]+.7152*q[1]+.0722*q[2];
        };
        const l1=lum(a),l2=lum(b);
        return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
      };
      for(const tema of ['light','dark','auto']){
        await page.emulateMedia({colorScheme:tema==='auto'?'dark':'light'});
        await page.evaluate(t=>document.documentElement.dataset.theme=t,tema);
        for(const width of [360,390,768,1280]){
          await page.setViewportSize({width,height:850});
          const medidas=await page.evaluate(()=>{
            const style=sel=>getComputedStyle(document.querySelector(sel));
            const get=sel=>({color:style(sel).color,bg:style(sel).backgroundColor});
            return {
              overflow:document.documentElement.scrollWidth-window.innerWidth,
              topo:document.querySelector('.page-heading').getBoundingClientRect().width,
              largura:document.getElementById('conteudo').getBoundingClientRect().width,
              banner:get('.admpro-banner.alerta'),
              aviso:get('.admpro-aviso.alerta'),
              suporte:get('.resposta-suporte'),
              suporteBg:style('.resposta-suporte').backgroundColor,
              ghost:style('#visual-fixture .btn.ghost').color,
              surface:style('#visual-fixture .card').backgroundColor,
              danger:get('#visual-fixture .btn.perigo'),
              toast:get('.toast-acao'),
              toastButton:style('.toast-acao button').color
            };
          });
          assert.ok(medidas.overflow<=2,`Rolagem horizontal: ${tema} ${width}px / ${JSON.stringify(medidas)}`);
          assert.ok(medidas.topo<=medidas.largura+2,`Cabeçalho ultrapassa conteúdo: ${tema} ${width}px`);
          for(const k of ['banner','aviso','suporte','danger']){
            assert.ok(contrast(medidas[k].color,medidas[k].bg)>=4.5,
              `Contraste de ${k} insuficiente: ${tema} ${width}px / ${JSON.stringify(medidas[k])}`);
          }
          assert.ok(contrast(medidas.ghost,medidas.surface)>=4.5,
            `Ação ghost ilegível no cartão: ${tema} ${width}px`);
          assert.ok(contrast(medidas.toastButton,medidas.toast.bg)>=4.5,
            `Botão da notificação ilegível: ${tema} ${width}px`);
        }
      }
      // Sem topbar ou sidebar, o login precisa ocupar a largura correta.
      await page.setViewportSize({width:1280,height:800});
      const layoutLogin=await page.evaluate(()=>{
        document.getElementById('topbar').hidden=true;
        document.getElementById('navegacao').hidden=true;
        const main=document.getElementById('conteudo');
        main.innerHTML=window.AdmPro.views.autenticacao.render();
        const rect=main.getBoundingClientRect();
        return {left:rect.left,right:innerWidth-rect.right,
          scroll:document.documentElement.scrollWidth-innerWidth,
          card:main.querySelector('.auth-page .card').getBoundingClientRect().width,
          viewport:innerWidth};
      });
      assert.ok(Math.abs(layoutLogin.left-layoutLogin.right)<=2,
        'Login sem navegação deve ficar centralizado: '+JSON.stringify(layoutLogin));
      assert.ok(layoutLogin.card>320&&layoutLogin.card<600,
        'Cartão de login deve ser confortável no desktop: '+JSON.stringify(layoutLogin));
      assert.ok(layoutLogin.scroll<=2,'Login não deve provocar rolagem lateral.');
      assert.deepEqual(erros,[],'Erros JS na auditoria visual');
    }finally{await context.close()}
  });

  await run('redução de permissões limpa dados financeiros armazenados',async()=>{
    const {page,context,erros}=await abrir('dono');
    try{
      await page.evaluate(async()=>{
        window.AdmPro.storage.adicionar('lancamentos',{id:'financeiro-local',tipo:'saida',valor:99,data:'2026-10-27',descricao:'Teste'});
        window.__admproMock.rebaixar();
        await window.AdmPro.auth.revalidarAcesso();
      });
      await page.goto(origin+'?perfil=dono#/financeiro');
      await page.getByText('Acesso restrito').waitFor();
      const n=await page.evaluate(()=>window.AdmPro.storage.lista('lancamentos').length);
      assert.equal(n,0);
      assert.deepEqual(erros,[]);
    }finally{await context.close()}
  });
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
if(failures)process.exitCode=1;
