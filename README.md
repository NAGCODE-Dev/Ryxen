
# CrossApp 🏋️

Progressive Web App para rastreamento e gestão de treinos de CrossFit, com cálculo automático de cargas baseado em recordes pessoais.

https://nikolasagc.github.io/CrossApp/

## 📋 Sobre o Projeto

CrossApp é uma aplicação web progressiva (PWA) desenvolvida para atletas de CrossFit que desejam acompanhar seus treinos diários, calcular cargas de trabalho com base em percentuais dos seus recordes pessoais (PRs) e manter um histórico completo de performance.

A aplicação permite importar PDFs de programação de treinos, extrai automaticamente os exercícios e percentuais, e calcula as cargas personalizadas para cada movimento baseado nos seus PRs cadastrados.

## ✨ Funcionalidades

- **Importação de PDFs**: Parse automático de planilhas de treino em formato PDF
- **Cálculo de Cargas**: Conversão automática de percentuais em cargas reais (kg/lbs)
- **Recordes Pessoais**: Cadastro e gerenciamento de PRs para todos os movimentos
- **Treino do Dia**: Visualização clara e responsiva do WOD (Workout of the Day)
- **Histórico**: Rastreamento de treinos realizados e progressão ao longo do tempo
- **Modo Offline**: Funciona sem conexão à internet graças ao Service Worker
- **Responsivo**: Interface otimizada para mobile e desktop

## 🚀 Tecnologias Utilizadas

- **JavaScript ES6+**: Código moderno com async/await e módulos
- **PWA**: Service Workers para funcionalidade offline
- **PDF.js**: Parsing e extração de texto de documentos PDF
- **IndexedDB/LocalStorage**: Persistência de dados local
- **HTML5/CSS3**: Interface responsiva e moderna
- **Vanilla JS**: Sem dependência de frameworks pesados

## 📦 Estrutura do Projeto

```
CrossApp/
├── index.html              # Página principal
├── manifest.json           # Manifesto PWA
├── service-worker.js       # Service Worker para cache offline
├── css/
│   └── styles.css          # Estilos da aplicação
├── js/
│   ├── app.js              # Lógica principal
│   ├── pdf-parser.js       # Parser de PDF
│   ├── load-calculator.js  # Cálculo de cargas
│   └── storage.js          # Gerenciamento de dados
└── assets/
    └── icons/              # Ícones para PWA
```

## 🔧 Instalação e Uso

### Requisitos

- Navegador moderno com suporte a PWA (Chrome, Firefox, Safari, Edge)
- Servidor web local ou hospedagem HTTPS (obrigatório para Service Workers)

### Instalação Local

1. Clone o repositório:
```bash
git clone https://github.com/NikolasAGC/CrossApp.git
cd CrossApp
```

2. Inicie um servidor local:
```bash
# Usando Python 3
python -m http.server 8000

# Usando Node.js (http-server)
npx http-server -p 8000
```

3. Acesse `http://localhost:8000` no navegador

### Instalação como PWA

1. Acesse a aplicação no navegador
2. Clique no ícone de instalação na barra de endereços
3. Confirme a instalação
4. Use como aplicativo nativo!

## 💡 Como Usar

### 1. Cadastrar Recordes Pessoais

- Acesse a seção de "PRs" ou "Recordes"
- Adicione seus recordes para movimentos como:
  - Squat Snatch
  - Power Snatch
  - Clean & Jerk
  - Back Squat
  - Front Squat, etc.

### 2. Importar Treino

- Clique em "Importar PDF" ou "Novo Treino"
- Selecione o arquivo PDF da programação
- O sistema irá extrair automaticamente os exercícios e percentuais

### 3. Visualizar Cargas

- As cargas serão calculadas automaticamente baseadas nos seus PRs
- Visualize o treino do dia com as cargas personalizadas
- Marque como concluído ao finalizar

## 🏗️ Arquitetura

### Parser de PDF
Utiliza PDF.js para extrair texto dos PDFs de programação e identifica:
- Movimentos e exercícios
- Percentuais de carga (ex: 70%, 85%, 90%)
- Séries e repetições
- Tempo de descanso

### Calculadora de Cargas
Recebe os percentuais e PRs cadastrados, retornando:
- Carga em kg ou lbs
- Arredondamento inteligente baseado nas anilhas disponíveis
- Conversão automática entre unidades

### Persistência
- **LocalStorage**: Configurações e preferências
- **IndexedDB**: Histórico de treinos e dados volumosos
- **Cache API**: Assets estáticos via Service Worker

## 🎯 Roadmap

- [ ] Integração com análise de movimento via ML
- [ ] Gráficos de progressão e analytics
- [ ] Compartilhamento de treinos
- [ ] Exportação de dados (CSV/JSON)
- [ ] Timer integrado (AMRAP, EMOM, Tabata)
- [ ] Modo dark/light theme

## 🐛 Debug e Desenvolvimento

### Console de Debug
```javascript
// Verificar dados armazenados
console.log(localStorage);

// Testar parser
await parsePDF(file);

// Limpar cache
caches.keys().then(names => names.forEach(name => caches.delete(name)));
```

## 👨‍💻 Desenvolvedor

**Nikolas AG**
- GitHub: [@NikolasAGC](https://github.com/NikolasAGC)
- Estudante de Desenvolvimento - IFSP
- Atleta de CrossFit

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🙏 Agradecimentos

- Comunidade CrossFit de Itapetininga
- Mozilla PDF.js
- Desenvolvedores da comunidade PWA

---

**Desenvolvido com 💪 por um atleta, para atletas**
