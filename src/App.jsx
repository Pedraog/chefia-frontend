import { useState, useEffect } from 'react';
import { Plus, MessageSquare, ChefHat, Send, Sparkles, LogOut, Lock, Mail, KeyRound, Menu, Search, Share2, X, Copy, Check, ExternalLink, Pin } from 'lucide-react'; // 🌟 Adicionado o ícone Pin
import { GoogleGenerativeAI } from '@google/generative-ai';
import Markdown from 'react-markdown';

const MINHA_API_KEY = "AIzaSyDRcJxPGmrhOtct34vqTSG8d-49er9dRWQ"; 

function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null); 
  const [modoAuth, setModoAuth] = useState('login'); 
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [erroAuth, setErroAuth] = useState('');

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]); 
  const [history, setHistory] = useState([]);

  const [sidebarAberta, setSidebarAberta] = useState(true); 
  const [termoPesquisa, setTermoPesquisa] = useState(''); 

  const [receitaPartilhada, setReceitaPartilhada] = useState(null);
  const [carregandoPartilha, setCarregandoPartilha] = useState(false);

  const [modalShareAberto, setModalShareAberto] = useState(false);
  const [linkParaCopiar, setLinkParaCopiar] = useState('');
  const [copiadoFeedback, setCopiadoFeedback] = useState(false);

  const API_URL = 'https://chefia-backend-ipea.onrender.com';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    
    if (shareId) {
      setCarregandoPartilha(true);
      fetch(`${API_URL}/publico/receita/${shareId}`)
        .then(res => res.json())
        .then(dados => {
          if (!dados.erro) setReceitaPartilhada(dados);
          setCarregandoPartilha(false);
        })
        .catch(() => setCarregandoPartilha(false));
    }
  }, []);

  const carregarHistorico = async (email) => {
    try {
      const resposta = await fetch(`${API_URL}/historico/${email}`);
      if (resposta.ok) setHistory(await resposta.json());
    } catch (err) { console.error(err); }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setErroAuth('');
    const rota = modoAuth === 'login' ? '/login' : '/registo';
    try {
      const resposta = await fetch(`${API_URL}${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput })
      });
      const dados = await resposta.json();
      if (!resposta.ok) return setErroAuth(dados.erro || dados.mensagem);

      if (modoAuth === 'login') {
        setUsuarioLogado(dados.utilizador);
        carregarHistorico(dados.utilizador);
      } else {
        alert('Conta criada!');
        setModoAuth('login');
      }
    } catch (err) { setErroAuth('Erro ao ligar ao servidor.'); }
  };

  const handlePedirCodigo = async (e) => {
    e.preventDefault();
    setErroAuth('');
    try {
      const resposta = await fetch(`${API_URL}/esqueci-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput })
      });
      const dados = await resposta.json();
      if (!resposta.ok) return setErroAuth(dados.erro);
      alert(dados.mensagem);
      setModoAuth('codigo');
    } catch (err) { setErroAuth('Erro ao ligar ao servidor.'); }
  };

  const handleRedefinirSenha = async (e) => {
    e.preventDefault();
    setErroAuth('');
    try {
      const resposta = await fetch(`${API_URL}/redefinir-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, codigo: codigoInput, novaPassword: passwordInput })
      });
      const dados = await resposta.json();
      if (!resposta.ok) return setErroAuth(dados.erro);
      alert(dados.mensagem);
      setModoAuth('login');
      setPasswordInput('');
      setCodigoInput('');
    } catch (err) { setErroAuth('Erro ao ligar ao servidor.'); }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const ingredientes = input;
    setInput('');
    setLoading(true);
    
    const novasMensagens = [...messages, { role: 'user', text: ingredientes }];
    setMessages(novasMensagens);

    try {
      const genAI = new GoogleGenerativeAI(MINHA_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `Act como um Chef de Cozinha profissional do chefIA. Cria uma receita focada nestes ingredientes: "${ingredientes}". Organiza a resposta usando Markdown simples: Usa títulos (###), listas com pontos e palavras importantes em negrito.`;
      
      const result = await model.generateContentStream(prompt);
      
      setMessages([...novasMensagens, { role: 'model', text: '', id: null }]); 
      setLoading(false); 

      let textoCompletoAcumulado = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        textoCompletoAcumulado += chunkText;
        setMessages([...novasMensagens, { role: 'model', text: textoCompletoAcumulado }]);
      }

      const resDb = await fetch(`${API_URL}/historico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: usuarioLogado, ingredientes: ingredientes, receita: textoCompletoAcumulado })
      });
      
      if (resDb.ok) {
        const respostaHistorico = await fetch(`${API_URL}/historico/${usuarioLogado}`);
        if (respostaHistorico.ok) {
          const novoHist = await respostaHistorico.json();
          setHistory(novoHist);
          if (novoHist.length > 0) {
            setMessages([...novasMensagens, { role: 'model', text: textoCompletoAcumulado, id: novoHist[0].id, fixado: novoHist[0].fixado }]);
          }
        }
      }

    } catch (error) {
      setMessages([...novasMensagens, { role: 'model', text: "❌ Erro ao gerar receita." }]);
      setLoading(false);
    }
  };

  // 🌟 NOVA FUNÇÃO: ALTERA ESTADO DE AFIXXAÇÃO NA BASE DE DADOS
  const handleToggleFixar = async (id, estadoAtual) => {
    try {
      const novoEstado = estadoAtual === 1 ? 0 : 1;
      const resposta = await fetch(`${API_URL}/historico/fixar/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixado: novoEstado })
      });
      if (resposta.ok) {
        carregarHistorico(usuarioLogado);
        // Atualiza a mensagem ativa na tela caso o utilizador esteja a vê-la
        setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, fixado: novoEstado } : msg));
      }
    } catch (err) { console.error(err); }
  };

  const abrirModalPartilha = (id) => {
    if (!id) return;
    const urlPublica = `${window.location.origin}?share=${id}`;
    setLinkParaCopiar(urlPublica);
    setCopiadoFeedback(false);
    setModalShareAberto(true);
  };

  const ejecutarCopia = () => {
    navigator.clipboard.writeText(linkParaCopiar);
    setCopiadoFeedback(true);
    setTimeout(() => setCopiadoFeedback(false), 2500);
  };

  const fecharVisualizacaoPublica = () => {
    window.history.pushState({}, '', window.location.origin);
    setReceitaPartilhada(null);
  };

  const historicoFiltrado = history.filter(item => 
    item.ingredientes.toLowerCase().includes(termoPesquisa.toLowerCase())
  );

  // 🌟 SEPARAÇÃO INTELIGENTE DAS CONVERSAS (Afixadas vs Recentes)
  const conversasFixadas = historicoFiltrado.filter(item => item.fixado === 1);
  const conversasRecentes = historicoFiltrado.filter(item => item.fixado !== 1);

  if (carregandoPartilha) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#131314] text-[#e3e3e3]">
        <div className="text-center space-y-2">
          <Sparkles className="w-8 h-8 text-[#74a2ff] animate-spin mx-auto" />
          <p className="text-sm text-[#9aa0a6]">A verificar link do chefIA...</p>
        </div>
      </div>
    );
  }

  if (receitaPartilhada) {
    return (
      <div className="min-h-screen bg-[#131314] text-[#e3e3e3] font-sans p-6 selection:bg-[#74a2ff]/20">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-[#37393b] pb-4">
            <div className="flex items-center gap-2">
              <ChefHat className="text-[#74a2ff] w-6 h-6" />
              <span className="font-semibold text-lg flex items-center gap-1">chefIA <Sparkles className="w-4 h-4 text-[#74a2ff]" /></span>
            </div>
            <button onClick={fecharVisualizacaoPublica} className="bg-[#74a2ff] hover:bg-[#638ee0] text-[#131314] text-xs font-semibold px-4 py-2 rounded-full transition-all">
              Criar a minha receita
            </button>
          </div>

          <div className="bg-[#1e1f20] border border-[#37393b] p-4 rounded-2xl text-sm">
            <span className="text-xs font-bold text-[#9aa0a6] block mb-1 uppercase tracking-wider">Ingredientes solicitados:</span>
            <span className="text-white font-medium">"{receitaPartilhada.ingredientes}"</span>
          </div>

          <div className="bg-[#1e1f20] border border-[#37393b] p-6 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center gap-1.5 text-[#74a2ff] font-semibold text-xs uppercase tracking-wider">
              <ChefHat className="w-4 h-4" /> Sugestão do chefIA:
            </div>
            <div className="prose prose-invert max-w-none text-sm space-y-2 leading-relaxed">
              <Markdown>{receitaPartilhada.receita}</Markdown>
            </div>
          </div>
          <p className="text-center text-xs text-[#5f6368]">Esta receita pública e interactiva foi criada e partilhada através do chefIA.</p>
        </div>
      </div>
    );
  }

  if (!usuarioLogado) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#131314] text-[#e3e3e3] p-4 font-sans">
        <div className="w-full max-w-md bg-[#1e1f20] p-8 rounded-2xl border border-[#37393b] shadow-2xl">
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className="w-12 h-12 bg-[#74a2ff]/10 text-[#74a2ff] rounded-full flex items-center justify-center">
              <ChefHat className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mt-2">
              {modoAuth === 'login' && 'Entrar no chefIA'}
              {modoAuth === 'registo' && 'Criar conta'}
              {modoAuth === 'esqueci' && 'Recuperar Conta'}
              {modoAuth === 'codigo' && 'Nova Palavra-passe'}
            </h2>
          </div>

          {erroAuth && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl text-center mb-4">{erroAuth}</div>}

          {(modoAuth === 'login' || modoAuth === 'registo') && (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#c4c7c5]">Email</label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-[#9aa0a6] absolute left-4" />
                  <input type="email" placeholder="teu@email.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-[#131314] border border-[#37393b] focus:border-[#74a2ff] outline-none rounded-xl py-3 pl-11 pr-4 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-[#c4c7c5]">Palavra-passe</label>
                  {modoAuth === 'login' && (
                    <button type="button" onClick={() => { setModoAuth('esqueci'); setErroAuth(''); }} className="text-xs text-[#74a2ff] hover:underline">Esqueste-te?</button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-[#9aa0a6] absolute left-4" />
                  <input type="password" placeholder="••••••••" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-[#131314] border border-[#37393b] focus:border-[#74a2ff] outline-none rounded-xl py-3 pl-11 pr-4 text-sm" />
                </div>
              </div>
              <button type="submit" className="w-full bg-[#74a2ff] hover:bg-[#638ee0] text-[#131314] font-semibold rounded-xl py-3 text-sm transition-colors mt-2">
                {modoAuth === 'login' ? 'Iniciar Sessão' : 'Registar Conta'}
              </button>
            </form>
          )}

          {modoAuth === 'esqueci' && (
            <form onSubmit={handlePedirCodigo} className="space-y-4">
              <p className="text-xs text-[#9aa0a6] text-center mb-2">Insere o teu e-mail para gerar o código no terminal do Backend.</p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#c4c7c5]">Email da Conta</label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-[#9aa0a6] absolute left-4" />
                  <input type="email" placeholder="teu@email.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-[#131314] border border-[#37393b] focus:border-[#74a2ff] outline-none rounded-xl py-3 pl-11 pr-4 text-sm" />
                </div>
              </div>
              <button type="submit" className="w-full bg-[#74a2ff] hover:bg-[#638ee0] text-[#131314] font-semibold rounded-xl py-3 text-sm transition-colors">Enviar Código</button>
            </form>
          )}

          {modoAuth === 'codigo' && (
            <form onSubmit={handleRedefinirSenha} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#c4c7c5]">Código de 6 dígitos</label>
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 text-[#9aa0a6] absolute left-4" />
                  <input type="text" placeholder="123456" value={codigoInput} onChange={(e) => setCodigoInput(e.target.value)} className="w-full bg-[#131314] border border-[#37393b] focus:border-[#74a2ff] outline-none rounded-xl py-3 pl-11 pr-4 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#c4c7c5]">Nova Palavra-passe</label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-[#9aa0a6] absolute left-4" />
                  <input type="password" placeholder="••••••••" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-[#131314] border border-[#37393b] focus:border-[#74a2ff] outline-none rounded-xl py-3 pl-11 pr-4 text-sm" />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-[#131314] font-semibold rounded-xl py-3 text-sm transition-colors">Alterar Palavra-passe</button>
            </form>
          )}

          <div className="text-center mt-6">
            <button onClick={() => { setModoAuth(modoAuth === 'login' ? 'registo' : 'login'); setErroAuth(''); }} className="text-xs text-[#74a2ff] hover:underline">
              {modoAuth === 'login' && 'Não tens conta? Cria uma aqui'}
              {modoAuth === 'registo' && 'Já tens conta? Faz login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#131314] text-[#e3e3e3] font-sans overflow-hidden relative">
      
      {/* BARRA LATERAL */}
      <aside className={`w-64 bg-[#1e1f20] p-4 flex flex-col justify-between transition-all duration-300 ${sidebarAberta ? 'translate-x-0 flex' : '-translate-x-full hidden'}`}>
        <div className="flex flex-col h-[calc(100vh-100px)]">
          <div className="flex items-center gap-2 mb-6 px-2">
            <ChefHat className="text-[#74a2ff] w-6 h-6" />
            <span className="font-semibold text-lg flex items-center gap-1">chefIA <Sparkles className="w-4 h-4 text-[#74a2ff]" /></span>
          </div>
          
          <button onClick={() => setMessages([])} className="flex items-center gap-3 bg-[#1a1a1c] hover:bg-[#282a2c] transition-colors rounded-full px-4 py-3 text-sm font-medium w-full mb-4 shrink-0 border border-[#37393b]">
            <Plus className="w-5 h-5 text-[#74a2ff]" /> Nova receita
          </button>

          <div className="relative flex items-center mb-4 px-1 shrink-0">
            <Search className="w-4 h-4 text-[#9aa0a6] absolute left-4" />
            <input type="text" placeholder="Pesquisar histórico..." value={termoPesquisa} onChange={(e) => setTermoPesquisa(e.target.value)} className="w-full bg-[#131314] border border-[#37393b] focus:border-[#74a2ff] outline-none rounded-xl py-2 pl-9 pr-3 text-xs text-[#e3e3e3]" />
          </div>

          {/* ÁREA DE SCROLL DOS CHATS */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {historicoFiltrado.length === 0 && (
              <p className="text-xs text-[#5f6368] px-2 italic">Nenhum chat encontrado.</p>
            )}

            {/* 📌 SECÇÃO 1: CONVERSAS AFIXADAS (Só aparece se houver alguma) */}
            {conversasFixadas.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-[#74a2ff] uppercase tracking-widest px-2 mb-2 flex items-center gap-1">
                  <Pin className="w-3 h-3 transform -rotate-45" /> Fixados
                </p>
                <div className="space-y-1">
                  {conversasFixadas.map((item) => (
                    <div key={item.id} className="flex items-center justify-between group rounded-full bg-[#74a2ff]/5 border border-[#74a2ff]/10 hover:bg-[#282a2c] px-3 py-1 transition-colors">
                      <button onClick={() => setMessages([{ role: 'user', text: item.ingredientes }, { role: 'model', text: item.receita, id: item.id, fixado: item.fixado }])} className="flex items-center gap-3 text-left text-sm text-[#e3e3e3] truncate flex-1 py-1">
                        <MessageSquare className="w-4 h-4 shrink-0 text-[#74a2ff]" />
                        <span className="truncate">{item.ingredientes}</span>
                      </button>
                      <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => handleToggleFixar(item.id, item.fixado)} className="p-1 text-[#74a2ff]" title="Desafixar">
                          <Pin className="w-3.5 h-3.5 fill-[#74a2ff] transform -rotate-45" />
                        </button>
                        <button onClick={() => abrirModalPartilha(item.id)} className="p-1 text-[#9aa0a6] hover:text-[#74a2ff]" title="Partilhar">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 🕒 SECÇÃO 2: CONVERSAS RECENTES */}
            {conversasRecentes.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-widest px-2 mb-2">Recentes</p>
                <div className="space-y-1">
                  {conversasRecentes.map((item) => (
                    <div key={item.id} className="flex items-center justify-between group rounded-full hover:bg-[#282a2c] px-3 py-1 transition-colors">
                      <button onClick={() => setMessages([{ role: 'user', text: item.ingredientes }, { role: 'model', text: item.receita, id: item.id, fixado: item.fixado }])} className="flex items-center gap-3 text-left text-sm text-[#c4c7c5] truncate flex-1 py-1">
                        <MessageSquare className="w-4 h-4 shrink-0 text-[#9aa0a6]" />
                        <span className="truncate">{item.ingredientes}</span>
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => handleToggleFixar(item.id, item.fixado)} className="p-1 text-[#9aa0a6] hover:text-white" title="Afixar no topo">
                          <Pin className="w-3.5 h-3.5 transform -rotate-45" />
                        </button>
                        <button onClick={() => abrirModalPartilha(item.id)} className="p-1 text-[#9aa0a6] hover:text-[#74a2ff]" title="Partilhar">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between border-t border-[#37393b] pt-4 px-2 shrink-0">
          <div className="flex items-center gap-3 truncate max-w-[170px]">
            <div className="w-8 h-8 shrink-0 rounded-full bg-[#74a2ff] text-[#131314] flex items-center justify-center font-bold text-sm uppercase">{usuarioLogado[0]}</div>
            <div className="text-sm truncate">
              <p className="font-medium text-white truncate">{usuarioLogado.split('@')[0]}</p>
              <p className="text-xs text-[#9aa0a6] truncate">{usuarioLogado}</p>
            </div>
          </div>
          <button onClick={() => { setUsuarioLogado(null); setHistory([]); setMessages([]); }} className="p-2 text-[#9aa0a6] hover:text-red-400 rounded-lg hover:bg-[#282a2c] transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ÁREA DO CHAT PRINCIPAL */}
      <main className="flex-1 flex flex-col justify-between p-4 relative max-w-4xl mx-auto w-full">
        
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setSidebarAberta(!sidebarAberta)} className="p-2 text-[#9aa0a6] hover:text-white rounded-xl hover:bg-[#282a2c] transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          {!sidebarAberta && (
            <div className="flex items-center gap-2">
              <ChefHat className="text-[#74a2ff] w-5 h-5" />
              <span className="font-semibold text-sm text-white flex items-center gap-1">chefIA <Sparkles className="w-3 h-3 text-[#74a2ff]" /></span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 mb-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center px-4">
              <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4 bg-gradient-to-r from-[#74a2ff] via-[#a374ff] to-[#ff74a2] bg-clip-text text-transparent">O que vamos cozinhar hoje?</h1>
              <p className="text-[#9aa0a6] text-sm md:text-base max-w-md">Passa o rato por cima de qualquer chat na barra lateral e clica no pione (📌) para prendê-lo no topo.</p>
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              {messages.map((msg, index) => (
                <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed relative group ${msg.role === 'user' ? 'bg-[#2b2c2e] text-white rounded-tr-none' : 'bg-[#1e1f20] text-[#e3e3e3] border border-[#37393b] rounded-tl-none'}`}>
                    
                    {msg.role === 'model' && (
                      <div className="flex items-center justify-between text-[#74a2ff] font-semibold mb-3 text-xs uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <ChefHat className="w-4 h-4" /> chefIA:
                        </div>
                      </div>
                    )}

                    {msg.role === 'model' ? (
                      <div className="space-y-4">
                        <div className="prose prose-invert max-w-none text-sm space-y-2">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                        
                        {/* BARRA DE AÇÕES INLINE */}
                        {msg.id && !loading && (
                          <div className="pt-2 border-t border-[#37393b]/50 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => abrirModalPartilha(msg.id)}
                              className="flex items-center gap-1.5 text-xs text-[#9aa0a6] hover:text-[#74a2ff] bg-[#131314]/50 hover:bg-[#131314] px-2.5 py-1.5 rounded-full border border-[#37393b] transition-all"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Partilhar</span>
                            </button>

                            {/* 🌟 BOTÃO EXTRA: PERMITE FIXAR LOGO DEPOIS DE GERAR NO PRÓPRIO CHAT */}
                            <button 
                              onClick={() => handleToggleFixar(msg.id, msg.fixado)}
                              className={`flex items-center gap-1.5 text-xs bg-[#131314]/50 hover:bg-[#131314] px-2.5 py-1.5 rounded-full border border-[#37393b] transition-all ${msg.fixado === 1 ? 'text-[#74a2ff] border-[#74a2ff]/30 bg-[#74a2ff]/5' : 'text-[#9aa0a6] hover:text-white'}`}
                            >
                              <Pin className={`w-3.5 h-3.5 transform -rotate-45 ${msg.fixado === 1 ? 'fill-[#74a2ff]' : ''}`} />
                              <span>{msg.fixado === 1 ? 'Afixado' : 'Afixar'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-4 justify-start items-start w-full animate-pulse">
                  <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl rounded-tl-none p-5 w-full max-w-xl space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#a374ff] uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 animate-spin" /> A idealizar a receita...
                    </div>
                    <div className="space-y-2">
                      <div className="h-2.5 bg-gradient-to-r from-[#74a2ff] via-[#a374ff] to-[#ff74a2] rounded-full w-full opacity-80"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-full mt-auto">
          <div className="bg-[#1e1f20] border border-[#37393b] focus-within:border-[#74a2ff] rounded-full p-2 pl-6 flex items-center gap-3 shadow-xl transition-all">
            <input type="text" placeholder="Ex: frango, natas, cogumelos..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} className="bg-transparent flex-1 outline-none text-[#e3e3e3] text-sm" disabled={loading} />
            <button onClick={handleSend} className={`p-2 rounded-full transition-all ${input.trim() && !loading ? 'bg-[#74a2ff] text-[#131314] scale-105' : 'text-[#5f6368]'}`} disabled={!input.trim() || loading}>
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </main>

      {/* MODAL COMPACTO DE PARTILHA */}
      {modalShareAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#1e1f20] border border-[#37393b] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#74a2ff]" /> Partilhar link da receita
              </h3>
              <button onClick={() => setModalShareAberto(false)} className="text-[#9aa0a6] hover:text-white p-1 rounded-lg hover:bg-[#282a2c] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#9aa0a6] leading-relaxed">Cria um link público para partilhares esta receita com amigos e familiares. Qualquer pessoa com o link poderá ler o conteúdo mesmo sem possuir conta.</p>
            <div className="flex items-center gap-2 bg-[#131314] border border-[#37393b] rounded-xl p-2 pl-3">
              <span className="text-xs text-[#c4c7c5] truncate flex-1 select-all font-mono">{linkParaCopiar}</span>
              <button onClick={executarCopia} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${copiadoFeedback ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#74a2ff] hover:bg-[#638ee0] text-[#131314]'}`}>
                {copiadoFeedback ? <><Check className="w-3.5 h-3.5" /><span>Copiado!</span></> : <><Copy className="w-3.5 h-3.5" /><span>Copiar</span></>}
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <a href={linkParaCopiar} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-[#74a2ff] hover:underline">
                <span>Testar visualização pública</span><ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;