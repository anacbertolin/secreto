/*
 * Cópia estática do site consumedolhos.com.br.
 * Substitui as partes que dependiam do WordPress:
 *  - caixa de busca  -> página /busca/ que procura no índice /busca/indice.json
 *  - comentários do blog e formulário de contato -> salvos no Supabase
 *    (tabela public.site_mensagens; visitante só consegue ENVIAR, nunca ler).
 */
(function () {
  'use strict';

  // Chave publicável do Supabase: é pública por natureza (pode ficar no site).
  var SUPABASE_URL = 'https://ogflxjolbwrzayjtxvhj.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_yCe68KKjOhjZ6aFknnvIrQ_fNI6W_QP';

  function enviarMensagem(dados) {
    return fetch(SUPABASE_URL + '/rest/v1/site_mensagens', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(dados)
    }).then(function (r) {
      if (!r.ok) throw new Error('falha ' + r.status);
    });
  }

  function valor(form, nome) {
    var el = form.querySelector('[name="' + nome + '"]');
    return el ? String(el.value || '').trim() : '';
  }

  function emailValido(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }

  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function aviso(form, texto, erro) {
    var box = form.querySelector('.copia-aviso');
    if (!box) {
      box = document.createElement('p');
      box.className = 'copia-aviso';
      box.setAttribute('role', 'status');
      box.style.cssText = 'margin-top:15px;padding:12px 15px;border-radius:6px;';
      form.appendChild(box);
    }
    box.style.background = erro ? '#fdecea' : '#e8f5e9';
    box.style.color = erro ? '#8a1c12' : '#1b5e20';
    box.textContent = texto;
  }

  // ---- Envio de formulários (fase de captura: roda antes do plugin antigo) ----
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!form || form.tagName !== 'FORM') return;

    // Busca
    if (form.classList.contains('search-form')) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      location.href = '/busca/?s=' + encodeURIComponent(valor(form, 's'));
      return;
    }

    var ehComentario = form.id === 'respond-form' || form.classList.contains('comment-form');
    var ehContato = form.classList.contains('wpcf7-form');
    if (!ehComentario && !ehContato) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();

    var dados = ehComentario ? {
      tipo: 'comentario',
      pagina: location.pathname,
      post_id: parseInt(valor(form, 'comment_post_ID'), 10) || null,
      nome: valor(form, 'author'),
      email: valor(form, 'email'),
      mensagem: valor(form, 'comment')
    } : {
      tipo: 'contato',
      pagina: location.pathname,
      nome: valor(form, 'contact-name'),
      email: valor(form, 'contact-email'),
      assunto: valor(form, 'contact-subject'),
      mensagem: valor(form, 'contact-message')
    };

    if (!dados.nome || !dados.email || !dados.mensagem || (ehContato && !dados.assunto)) {
      aviso(form, 'Por favor, preencha todos os campos obrigatórios.', true);
      return;
    }
    if (!emailValido(dados.email)) {
      aviso(form, 'Por favor, informe um e-mail válido.', true);
      return;
    }

    var botao = form.querySelector('[type="submit"]');
    if (botao) botao.disabled = true;
    enviarMensagem(dados).then(function () {
      form.reset();
      aviso(form, ehComentario
        ? 'Obrigado! Seu comentário foi enviado e aguarda aprovação.'
        : 'Obrigado pela sua mensagem. Ela foi enviada.');
    }).catch(function () {
      aviso(form, 'Não foi possível enviar agora. Tente novamente ou fale conosco pelo WhatsApp.', true);
    }).then(function () {
      if (botao) botao.disabled = false;
    });
  }, true);

  // ---- Página de resultados da busca ----
  function semAcento(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function montarBusca() {
    var alvo = document.getElementById('busca-resultados');
    if (!alvo) return;
    var termo = (new URLSearchParams(location.search).get('s') || '').trim();
    document.title = 'Resultados da pesquisa por “' + termo + '” – Hospital de Olhos da Baixada';
    document.getElementById('busca-titulo').textContent = termo;
    document.getElementById('busca-trilha').textContent = 'Search results for: ' + termo;
    document.querySelectorAll('.search-form input[name="s"]').forEach(function (i) { i.value = termo; });

    fetch('/busca/indice.json').then(function (r) { return r.json(); }).then(function (itens) {
      var palavras = semAcento(termo).split(/\s+/).filter(Boolean);
      var achados = itens.filter(function (it) {
        var t = semAcento(it.titulo + ' ' + it.texto);
        return palavras.length && palavras.every(function (p) { return t.indexOf(p) !== -1; });
      }).sort(function (a, b) {
        var ta = palavras.every(function (p) { return semAcento(a.titulo).indexOf(p) !== -1; });
        var tb = palavras.every(function (p) { return semAcento(b.titulo).indexOf(p) !== -1; });
        if (ta !== tb) return ta ? -1 : 1;
        return a.data < b.data ? 1 : -1;
      });

      if (!achados.length) {
        alvo.innerHTML =
          '<div class="notfound-cont text-center"><h1>Sorry</h1><h2> No Results Found for "' +
          escapar(termo) + '"</h2><h6>Try a new search</h6><div class="subscribe">' +
          '<div class="form-group subform search_form"><form class="search-form" action="/busca/" method="get">' +
          ' <input type="search" name="s" placeholder="Fazer pesquisa aqui..." value="' + escapar(termo) + '">' +
          ' <button type="submit"><i class="fa fa-search"></i></button></form></div></div></div>';
        return;
      }
      alvo.outerHTML = achados.map(function (it) {
        var url = escapar(it.url);
        return '<div id="post-' + it.id + '" class="col-md-12 col-sm-12 col-xs-12 single_post post-' + it.id +
          ' hentry"><div class="single-blog"><div class="blog-bottom"><div class="post-content">' +
          '<h4 class="post-title mt-0"> <a href="' + url + '">' + escapar(it.titulo) + '</a></h4>' +
          '<p class="post-description"> ' + escapar(it.resumo) + '</p>' +
          '<div> <a href="' + url + '" class="read-more-btn"> Leia Mais <i class="fa fa-angle-right"></i> </a></div>' +
          '</div></div></div></div>';
      }).join('');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarBusca);
  else montarBusca();
})();
